/**
 * Tool Search (Tier 3.5)
 *
 * Enables searching for tools by name, description, or parameters.
 * Can search across all agents or filter to a specific agent.
 *
 * Note: Workflow suggestions are now handled by workflows_list which
 * reads from YAML protocol files (the single source of truth).
 */

import {
  AiluminaToolResponse,
  ToolSchema,
  ToolSearchParams
} from '../types.js';
import { AgentConfigLoader } from '../config/agent-loader.js';
import { MCPClientManager } from '../mcp/client-manager.js';
import { inferToolCategory, ToolCategory, CATEGORY_DESCRIPTIONS } from '../utils/tool-categories.js';

export interface ToolSearchResult {
  tool: ToolSchema;
  agent_name: string;
  mcp_server: string;      // MCP server providing this tool
  category: ToolCategory;  // Inferred tool category
  relevance_score: number;
  match_reason: string;
}

/**
 * Search tools by name, description, or parameters
 *
 * Uses fuzzy matching and keyword search to help discover relevant tools.
 * Future enhancement: semantic search via embedding service.
 */
export class ToolSearchTool {
  constructor(
    private agentLoader: AgentConfigLoader,
    private mcpClientManager: MCPClientManager
  ) {}

  async execute(params: ToolSearchParams): Promise<AiluminaToolResponse> {
    try {
      const query = params.query.toLowerCase();
      const limit = params.limit || 10;
      const fuzzy = params.fuzzy !== false; // Default true

      // Refresh agents if cache is stale
      await this.agentLoader.getAgentsWithRefresh();

      // Determine which agents to search
      let agentsToSearch: string[];
      if (params.agent_name) {
        // Verify agent exists
        const agent = this.agentLoader.getAgent(params.agent_name);
        if (!agent) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: `Agent not found: ${params.agent_name}`,
                  available_agents: this.agentLoader.listAgents().map(a => a.name)
                }, null, 2)
              }
            ],
            isError: true
          };
        }
        agentsToSearch = [params.agent_name];
      } else {
        // Search all agents
        agentsToSearch = this.agentLoader.listAgents().map(a => a.name);
      }

      // Collect and search tools
      const results: ToolSearchResult[] = [];

      for (const agentName of agentsToSearch) {
        const agent = this.agentLoader.getAgent(agentName);
        if (!agent) continue;

        const tools = this.mcpClientManager.getToolsForAgent(
          agentName,
          agent.assigned_mcp_servers,
          agent.assigned_mcp_tools
        );

        for (const tool of tools) {
          // Infer MCP server from tool name prefix (e.g., "memory_semantic_search" -> "memory")
          const mcpServer = tool.name.includes('_')
            ? tool.name.split('_')[0]
            : agent.mcp_servers[0] || 'unknown';

          // Infer category
          const category = inferToolCategory(mcpServer, tool.name, tool.description);

          // Apply category filter if specified
          if (params.category && category !== params.category) {
            continue;
          }

          const matchResult = this.scoreTool(tool, query, fuzzy);

          if (matchResult.score > 0) {
            results.push({
              tool,
              agent_name: agentName,
              mcp_server: mcpServer,
              category,
              relevance_score: matchResult.score,
              match_reason: matchResult.reason
            });
          }
        }
      }

      // Sort by relevance score (descending)
      results.sort((a, b) => b.relevance_score - a.relevance_score);

      // Limit results
      const topResults = results.slice(0, limit);

      // Format response
      const scopeText = params.agent_name
        ? `within agent "${params.agent_name}"`
        : 'across all agents';

      const categoryText = params.category
        ? `\nCategory: **${params.category}** - ${CATEGORY_DESCRIPTIONS[params.category as ToolCategory]}`
        : '';

      const overview = `🔍 **Tool Search Results**

Query: "${params.query}" ${scopeText}${categoryText}
Found ${results.length} matching tools (showing top ${topResults.length}):

${topResults.map((r, i) => {
  const params = Object.keys(r.tool.inputSchema?.properties || {});
  const paramText = params.length > 0
    ? `Params: ${params.slice(0, 3).join(', ')}${params.length > 3 ? '...' : ''}`
    : 'No parameters';

  return `${i + 1}. **${r.tool.name}** (score: ${r.relevance_score.toFixed(2)})
   Agent: ${r.agent_name} | Category: ${r.category} | Server: ${r.mcp_server}
   ${r.tool.description}
   ${paramText}
   Match: ${r.match_reason}`;
}).join('\n\n')}

${results.length === 0 ? '💡 Try a broader search term or browse tools with agents_tools_list.' : ''}

${this.generateWorkflowHints(topResults)}

**Next step:** Use agents_tools_call to invoke any tool.

---

`;

      return {
        content: [
          {
            type: "text",
            text: overview + JSON.stringify({
              query: params.query,
              scope: params.agent_name || 'all_agents',
              total_matches: results.length,
              results: topResults.map(r => ({
                tool_name: r.tool.name,
                agent_name: r.agent_name,
                description: r.tool.description,
                relevance_score: r.relevance_score,
                match_reason: r.match_reason
              }))
            }, null, 2)
          }
        ],
        isError: false
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: 'Failed to search tools',
              details: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  /**
   * Score a tool based on query relevance
   */
  private scoreTool(
    tool: ToolSchema,
    query: string,
    fuzzy: boolean
  ): { score: number; reason: string } {
    let score = 0;
    const reasons: string[] = [];

    const name = tool.name.toLowerCase();
    const description = (tool.description || '').toLowerCase();

    // Get parameter names and descriptions
    const paramNames = Object.keys(tool.inputSchema?.properties || {}).join(' ').toLowerCase();
    const paramDescriptions = Object.values(tool.inputSchema?.properties || {})
      .map((p: any) => p.description || '')
      .join(' ')
      .toLowerCase();

    // Exact name match (highest priority)
    if (name === query) {
      score += 10;
      reasons.push('exact name match');
    }
    // Name contains query
    else if (name.includes(query)) {
      score += 8;
      reasons.push('name match');
    }
    // Fuzzy name match
    else if (fuzzy && this.fuzzyMatch(name, query)) {
      score += 5;
      reasons.push('fuzzy name match');
    }

    // Description contains query
    if (description.includes(query)) {
      score += 6;
      reasons.push('description match');
    }
    // Fuzzy description match
    else if (fuzzy && this.fuzzyMatch(description, query)) {
      score += 3;
      reasons.push('fuzzy description match');
    }

    // Parameter name match
    if (paramNames.includes(query)) {
      score += 5;
      reasons.push('parameter name match');
    }

    // Parameter description match
    if (paramDescriptions.includes(query)) {
      score += 4;
      reasons.push('parameter description match');
    }

    // Check examples if available
    if (tool.examples && tool.examples.length > 0) {
      const exampleText = tool.examples
        .map(ex => `${ex.name || ''} ${ex.description || ''}`)
        .join(' ')
        .toLowerCase();

      if (exampleText.includes(query)) {
        score += 3;
        reasons.push('example match');
      }
    }

    return {
      score,
      reason: reasons.length > 0 ? reasons.join(', ') : 'no match'
    };
  }

  /**
   * Generate workflow hints - points to workflows_list for protocol discovery
   *
   * Note: Detailed workflow guidance moved to YAML protocols.
   * Use workflows_list to discover available protocols.
   */
  private generateWorkflowHints(results: ToolSearchResult[]): string {
    if (results.length === 0) return '';

    // Extract MCP server from top result
    const topTool = results[0];
    const mcpServer = topTool.mcp_server;

    // Provide contextual hints based on which MCP server the tool is from
    const serverHints: Record<string, string> = {
      'memory': 'Use `workflows_list` to see memory exploration protocols.',
      'mesh': 'Use `workflows_list` to see mesh communication protocols.',
      'recall': 'Use `workflows_list` to see conversation recall protocols.',
      'strava': 'Use `workflows_list` to see activity tracking protocols.',
      'facts': 'Use `workflows_list` to see facts discovery protocols.',
    };

    const hint = serverHints[mcpServer] ||
      'Use `workflows_list` to discover available protocols and multi-tool workflows.';

    return `\n**💡 Workflow Guidance:**\n${hint}\n`;
  }

  /**
   * Simple fuzzy matching - checks if query words appear in text
   */
  private fuzzyMatch(text: string, query: string): boolean {
    const queryWords = query.split(/\s+/).filter(w => w.length > 2);
    if (queryWords.length === 0) return false;

    let matchCount = 0;
    for (const word of queryWords) {
      if (text.includes(word)) {
        matchCount++;
      }
    }

    // Match if at least 50% of query words found
    return matchCount >= Math.ceil(queryWords.length * 0.5);
  }
}
