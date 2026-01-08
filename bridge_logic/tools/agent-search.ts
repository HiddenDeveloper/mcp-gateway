/**
 * Agent Search Tool (Tier 1.5)
 *
 * Enables searching for agents by name, description, or capabilities.
 * Supports both keyword matching and semantic search for better discovery.
 */

import {
  AiluminaToolResponse,
  AgentSummary
} from '../types.js';
import { AgentConfigLoader } from '../config/agent-loader.js';
import { MCPClientManager } from '../mcp/client-manager.js';

export interface AgentSearchParams {
  query: string;
  limit?: number;
  fuzzy?: boolean;
}

export interface AgentSearchResult {
  agent: AgentSummary;
  tool_count: number;
  relevance_score: number;
  match_reason: string;
}

/**
 * Search agents by name, description, or capabilities
 *
 * Uses fuzzy matching and keyword search to help discover relevant agents.
 * Future enhancement: semantic search via embedding service.
 */
export class AgentSearchTool {
  constructor(
    private agentLoader: AgentConfigLoader,
    private mcpClientManager: MCPClientManager
  ) {}

  async execute(params: AgentSearchParams): Promise<AiluminaToolResponse> {
    try {
      const query = params.query.toLowerCase();
      const limit = params.limit || 10;
      const fuzzy = params.fuzzy !== false; // Default true

      // Refresh agents if cache is stale
      await this.agentLoader.getAgentsWithRefresh();

      // Get all agents
      const allAgents = this.agentLoader.listAgents();

      // Search and score agents
      const results: AgentSearchResult[] = [];

      for (const agent of allAgents) {
        // Get full config to access assigned_mcp_tools
        const fullAgent = this.agentLoader.getAgent(agent.name);
        const toolCount = this.mcpClientManager.getToolsForAgent(
          agent.name,
          agent.mcp_servers,
          fullAgent?.assigned_mcp_tools
        ).length;

        const matchResult = this.scoreAgent(agent, toolCount, query, fuzzy);

        if (matchResult.score > 0) {
          results.push({
            agent,
            tool_count: toolCount,
            relevance_score: matchResult.score,
            match_reason: matchResult.reason
          });
        }
      }

      // Sort by relevance score (descending)
      results.sort((a, b) => b.relevance_score - a.relevance_score);

      // Limit results
      const topResults = results.slice(0, limit);

      // Format response
      const overview = `🔍 **Agent Search Results**

Query: "${params.query}"
Found ${results.length} matching agents (showing top ${topResults.length}):

${topResults.map((r, i) =>
  `${i + 1}. **${r.agent.name}** (score: ${r.relevance_score.toFixed(2)})
   ${r.agent.description || 'No description'}
   Tools: ${r.tool_count} | Match: ${r.match_reason}`
).join('\n\n')}

${results.length === 0 ? '💡 Try a broader search term or use agents_list to see all agents.' : ''}

**Next step:** Use agents_get to see detailed configuration of any agent.

---

`;

      return {
        content: [
          {
            type: "text",
            text: overview + JSON.stringify({
              query: params.query,
              total_matches: results.length,
              results: topResults
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
              error: 'Failed to search agents',
              details: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  /**
   * Score an agent based on query relevance
   */
  private scoreAgent(
    agent: AgentSummary,
    toolCount: number,
    query: string,
    fuzzy: boolean
  ): { score: number; reason: string } {
    let score = 0;
    const reasons: string[] = [];

    const name = agent.name.toLowerCase();
    const description = (agent.description || '').toLowerCase();
    const mcpServers = agent.mcp_servers.join(' ').toLowerCase();

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
    // Fuzzy name match (partial)
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

    // MCP server name match
    if (mcpServers.includes(query)) {
      score += 4;
      reasons.push('MCP server match');
    }

    // Tool count bonus (agents with tools are more useful)
    if (toolCount > 0 && score > 0) {
      score += Math.log(toolCount + 1) * 0.5;
      reasons.push(`${toolCount} tools`);
    }

    return {
      score,
      reason: reasons.length > 0 ? reasons.join(', ') : 'no match'
    };
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
