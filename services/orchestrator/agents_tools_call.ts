/**
 * Agents Tools Call (Tier 4)
 *
 * Execute a tool on behalf of an agent.
 * Routes to appropriate gateway endpoint based on tool name.
 */

import { getAgent } from "./lib/agent-loader";
import { getToolConfig, buildToolEndpoint, GATEWAY_URL } from "./lib/config";
import { getService } from "./lib/service-registry";
import type { AgentsToolsCallParams } from "./lib/types";

export default async function (params: Record<string, unknown>) {
  const { agent_name, tool_name, arguments: toolArgs } = params as AgentsToolsCallParams;

  if (!agent_name) {
    throw new Error("Missing required parameter: agent_name");
  }
  if (!tool_name) {
    throw new Error("Missing required parameter: tool_name");
  }

  try {
    // Verify agent exists
    const agent = await getAgent(agent_name);
    if (!agent) {
      return {
        error: `Agent not found: ${agent_name}`,
        available_agents: "Use agents_list to see available agents",
      };
    }

    // Parse tool name (format: service_toolname)
    const parts = tool_name.split("_");
    if (parts.length < 2) {
      return {
        error: `Invalid tool name format: ${tool_name}`,
        expected_format: "service_toolname (e.g., memory_semantic_search)",
      };
    }

    const serviceName = parts[0];
    const actualToolName = parts.slice(1).join("_");

    // Get service configuration
    const service = getService(serviceName);
    if (!service) {
      return {
        error: `Unknown service: ${serviceName}`,
        available_services: ["memory", "mesh", "recall"],
      };
    }

    // Find tool in service
    const tool = service.tools.find(t => t.name === actualToolName);
    if (!tool) {
      return {
        error: `Tool not found: ${actualToolName} in service ${serviceName}`,
        available_tools: service.tools.map(t => t.name),
      };
    }

    // Build endpoint URL
    let endpoint = `${GATEWAY_URL}${service.baseUrl}${tool.endpoint}`;

    // Handle path parameters (e.g., /thread/{messageId})
    if (tool.endpoint.includes("{") && toolArgs) {
      for (const [key, value] of Object.entries(toolArgs)) {
        endpoint = endpoint.replace(`{${key}}`, String(value));
      }
    }

    console.log(`[orchestrator/agents_tools_call] Calling ${tool_name} at ${endpoint}`);

    // Make the request
    const response = await fetch(endpoint, {
      method: tool.method,
      headers: {
        "Content-Type": "application/json",
      },
      ...(tool.method === "POST" && toolArgs && {
        body: JSON.stringify(toolArgs),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        error: `Tool call failed: ${response.status} ${response.statusText}`,
        details: errorText,
      };
    }

    const result = await response.json();

    return {
      tool_name,
      agent_name,
      result,
    };
  } catch (error) {
    console.error("[orchestrator/agents_tools_call] Error:", error);
    throw error;
  }
}
