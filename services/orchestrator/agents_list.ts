/**
 * Agents List (Tier 1)
 *
 * List all available agents with their capabilities summary.
 */

import { callBridgeTool, type AgentsListParams } from "./lib/config";

export default async function (params: Record<string, unknown>) {
  const { mcp_server, limit } = params as AgentsListParams;

  try {
    const result = await callBridgeTool("agents_list", {
      ...(mcp_server && { mcp_server }),
      ...(limit && { limit }),
    });
    return result;
  } catch (error) {
    console.error("[orchestrator/agents/list] Error:", error);
    throw error;
  }
}
