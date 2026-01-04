/**
 * Agents Tools List (Tier 3)
 *
 * Get tool schemas for a specific agent.
 */

import { callBridgeTool, type AgentsToolsListParams } from "./lib/config";

export default async function (params: Record<string, unknown>) {
  const { agent_name } = params as AgentsToolsListParams;

  if (!agent_name) {
    throw new Error("Missing required parameter: agent_name");
  }

  try {
    const result = await callBridgeTool("agents_tools_list", { agent_name });
    return result;
  } catch (error) {
    console.error("[orchestrator/agents/tools_list] Error:", error);
    throw error;
  }
}
