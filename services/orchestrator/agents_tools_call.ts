/**
 * Agents Tools Call (Tier 4)
 *
 * Execute a tool on behalf of an agent.
 */

import { callBridgeTool, type AgentsToolsCallParams } from "./lib/config";

export default async function (params: Record<string, unknown>) {
  const { agent_name, tool_name, arguments: toolArgs } = params as AgentsToolsCallParams;

  if (!agent_name) {
    throw new Error("Missing required parameter: agent_name");
  }
  if (!tool_name) {
    throw new Error("Missing required parameter: tool_name");
  }

  try {
    const result = await callBridgeTool("agents_tools_call", {
      agent_name,
      tool_name,
      arguments: toolArgs || {},
    });
    return result;
  } catch (error) {
    console.error("[orchestrator/agents/tools_call] Error:", error);
    throw error;
  }
}
