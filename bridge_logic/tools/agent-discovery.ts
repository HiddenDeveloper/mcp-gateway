/**
 * Agent Discovery Tools (Tier 1-2)
 *
 * Provides progressive disclosure of agent capabilities:
 * - Tier 1: List all available agents (agents/list)
 * - Tier 2: Get detailed agent information (agents/get)
 */

import {
  AiluminaToolResponse,
  AgentsListParams,
  AgentsGetParams,
  AgentListResponse,
  AgentDetails
} from '../types.js';
import { AgentConfigLoader } from '../config/agent-loader.js';
import { MCPClientManager } from '../mcp/client-manager.js';

/**
 * Tier 1: List all available agents
 *
 * Returns high-level overview of all agents in the system.
 * This is the entry point for discovering what agents exist.
 */
export class AgentsListTool {
  constructor(
    private agentLoader: AgentConfigLoader,
    private mcpClientManager: MCPClientManager
  ) {}

  async execute(params: AgentsListParams): Promise<AiluminaToolResponse> {
    try {
      // Refresh agents if cache is stale
      await this.agentLoader.getAgentsWithRefresh();

      // Get agent summaries (includes function_count and agent_count from config)
      let summaries = this.agentLoader.listAgents();

      // Filter by MCP server if specified
      if (params.mcp_server) {
        summaries = summaries.filter(s =>
          s.mcp_servers.includes(params.mcp_server!)
        );
      }

      // Populate MCP tool counts and calculate totals
      let agentsWithToolCounts = summaries.map(summary => {
        // Get full agent config to access assigned_mcp_tools
        const agent = this.agentLoader.getAgent(summary.name);
        const mcpToolCount = this.mcpClientManager.getToolsForAgent(
          summary.name,
          summary.mcp_servers,
          agent?.assigned_mcp_tools
        ).length;

        return {
          ...summary,
          mcp_tool_count: mcpToolCount,
          total_tools: summary.function_count + summary.agent_count + mcpToolCount
        };
      });

      // Apply limit if specified
      if (params.limit && params.limit > 0) {
        // Sort by total_tools descending before limiting
        agentsWithToolCounts.sort((a, b) => b.total_tools - a.total_tools);
        agentsWithToolCounts = agentsWithToolCounts.slice(0, params.limit);
      }

      const response: AgentListResponse = {
        agents: agentsWithToolCounts
      };

      // Count agents with tools
      const agentsWithTools = agentsWithToolCounts.filter(a => a.total_tools > 0).length;

      const filterInfo = params.mcp_server
        ? `\nFiltered by MCP server: **${params.mcp_server}**`
        : '';
      const limitInfo = params.limit
        ? `\nShowing top ${params.limit} agents (sorted by tool count)`
        : '';

      const overview = `📋 **Tier 1: Agent Discovery**${filterInfo}${limitInfo}

Found ${agentsWithToolCounts.length} agents${params.mcp_server ? ` using "${params.mcp_server}" server` : ' in the system'}:
- ${agentsWithTools} agents have tools configured
- ${agentsWithToolCounts.length - agentsWithTools} agents have no tools configured

**Top agents by tool count:**
${agentsWithToolCounts
  .filter(a => a.total_tools > 0)
  .sort((a, b) => b.total_tools - a.total_tools)
  .slice(0, 5)
  .map(a => `  • ${a.name}: ${a.total_tools} tools${a.protocol ? ` [${a.protocol}]` : ''}`)
  .join('\n')}

**Next step:** Use agents_get with an agent name to see detailed configuration and tool names.

---

`;

      return {
        content: [
          {
            type: "text",
            text: overview + JSON.stringify(response, null, 2)
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
              error: 'Failed to list agents',
              details: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }
}

/**
 * Tier 2: Get detailed agent information
 *
 * Returns comprehensive details about a specific agent including:
 * - Description and system prompt
 * - MCP servers it has access to
 * - List of available tools (names only, not schemas)
 * - Tool count
 */
export class AgentsGetTool {
  constructor(
    private agentLoader: AgentConfigLoader,
    private mcpClientManager: MCPClientManager
  ) {}

  async execute(params: AgentsGetParams): Promise<AiluminaToolResponse> {
    try {
      // Refresh agents if cache is stale
      await this.agentLoader.getAgentsWithRefresh();

      // Get agent configuration
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

      // Get MCP tool names (not full schemas - that's Tier 3)
      // Uses granular filtering if assigned_mcp_tools is specified
      const mcpToolNames = this.mcpClientManager.getToolNamesForAgent(
        agent.name,
        agent.assigned_mcp_servers,
        agent.assigned_mcp_tools
      );

      // Calculate counts
      const functionCount = agent.assigned_functions.length;
      const agentCount = agent.assigned_agents.length;
      const mcpToolCount = mcpToolNames.length;
      const totalTools = functionCount + agentCount + mcpToolCount;

      // Combine all tools for display
      const allTools = [
        ...agent.assigned_functions,
        ...agent.assigned_agents.map(a => `delegate_to_${a}`),
        ...mcpToolNames
      ];

      const response: AgentDetails = {
        name: agent.name,
        description: agent.description,
        system_prompt: agent.system_prompt,
        protocol: agent.protocol,
        // Assigned capabilities
        assigned_functions: agent.assigned_functions,
        assigned_agents: agent.assigned_agents,
        assigned_mcp_servers: agent.assigned_mcp_servers,
        // All tools combined
        tools: allTools,
        // Counts
        function_count: functionCount,
        agent_count: agentCount,
        mcp_tool_count: mcpToolCount,
        total_tools: totalTools,
        // Legacy field
        mcp_servers: agent.assigned_mcp_servers
      };

      const overview = `🔍 **Tier 2: Agent Details - ${agent.name}**

${agent.description}
${agent.protocol ? `\n**Protocol:** ${agent.protocol} (use execute_protocol for deterministic execution)` : ''}

**Assigned Functions:** ${functionCount > 0 ? agent.assigned_functions.join(', ') : 'None'}
**Assigned Agents:** ${agentCount > 0 ? agent.assigned_agents.join(', ') : 'None'}
**MCP Server Access:** ${agent.assigned_mcp_servers.length > 0 ? agent.assigned_mcp_servers.join(', ') : 'None'}

**Tool Summary:**
  • Functions: ${functionCount}
  • Agent Delegates: ${agentCount}
  • MCP Tools: ${mcpToolCount}
  • **Total: ${totalTools}**

${totalTools > 0 ? `**All Available Tools:**
${allTools.slice(0, 10).map(t => `  • ${t}`).join('\n')}${allTools.length > 10 ? `\n  ... and ${allTools.length - 10} more` : ''}` : 'No tools available for this agent.'}

**Next step:** ${totalTools > 0 ? `Use agents_tools_list with agent_name="${agent.name}" to see full tool schemas and parameter details.` : 'This agent has no tools configured.'}

---

`;

      return {
        content: [
          {
            type: "text",
            text: overview + JSON.stringify(response, null, 2)
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
              error: 'Failed to get agent details',
              details: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }
}
