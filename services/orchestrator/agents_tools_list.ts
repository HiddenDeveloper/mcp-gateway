/**
 * Agents Tools List (Tier 3)
 *
 * Get tool schemas for a specific agent.
 * Returns full JSON schemas for all tools assigned to the agent.
 */

import { getAgent, getAgentToolNames } from "./lib/agent-loader";
import {
  getServiceRegistry,
  getServiceToolSchemas,
  getFilteredToolSchemas,
  toToolSchema,
} from "./lib/service-registry";
import type { AgentsToolsListParams, ToolSchema } from "./lib/types";

export default async function (params: Record<string, unknown>) {
  const { agent_name } = params as AgentsToolsListParams;

  if (!agent_name) {
    throw new Error("Missing required parameter: agent_name");
  }

  try {
    const agent = await getAgent(agent_name);

    if (!agent) {
      return {
        error: `Agent not found: ${agent_name}`,
        available_agents: "Use agents_list to see available agents",
      };
    }

    const tools: ToolSchema[] = [];
    const serviceRegistry = getServiceRegistry();

    // Add function tools (stub schemas)
    for (const fn of agent.assigned_functions || []) {
      tools.push({
        name: fn,
        description: `Function: ${fn}`,
        inputSchema: {
          type: "object",
          properties: {},
        },
      });
    }

    // Add delegation tools
    for (const agentName of agent.assigned_agents || []) {
      tools.push({
        name: `delegate_to_${agentName}`,
        description: `Delegate task to agent: ${agentName}`,
        inputSchema: {
          type: "object",
          properties: {
            request: {
              type: "string",
              description: "The request to send to the agent",
            },
          },
          required: ["request"],
        },
      });
    }

    // Add MCP service tools
    for (const serverName of agent.assigned_mcp_servers || []) {
      if (agent.assigned_mcp_tools?.[serverName]?.length) {
        // Specific tools only
        const filtered = getFilteredToolSchemas(serverName, agent.assigned_mcp_tools[serverName]);
        tools.push(...filtered);
      } else {
        // All tools from server
        const all = getServiceToolSchemas(serverName);
        tools.push(...all);
      }
    }

    // Add granular tools from servers not in full access list
    if (agent.assigned_mcp_tools) {
      for (const [serverName, toolNames] of Object.entries(agent.assigned_mcp_tools)) {
        if (!agent.assigned_mcp_servers?.includes(serverName)) {
          const filtered = getFilteredToolSchemas(serverName, toolNames);
          tools.push(...filtered);
        }
      }
    }

    console.log(`[orchestrator/agents_tools_list] Returning ${tools.length} tools for: ${agent_name}`);

    return {
      agent_name,
      tools,
      count: tools.length,
    };
  } catch (error) {
    console.error("[orchestrator/agents_tools_list] Error:", error);
    throw error;
  }
}
