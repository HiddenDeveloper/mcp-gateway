/**
 * Agents Get (Tier 2)
 *
 * Get detailed information about a specific agent.
 */

import { callBridgeTool, type AgentsGetParams } from "./lib/config";

export default async function (params: Record<string, unknown>) {
  const { agent_name } = params as AgentsGetParams;

  if (!agent_name) {
    throw new Error("Missing required parameter: agent_name");
  }

  try {
    const result = await callBridgeTool("agents_get", { agent_name });
    return result;
  } catch (error) {
    console.error("[orchestrator/agents/get] Error:", error);
    throw error;
  }
}
