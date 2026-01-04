/**
 * Get Agent Config
 *
 * Get full agent configuration (admin view).
 */

import { callBridgeTool } from "./lib/config";

interface GetAgentParams {
  agent_name: string;
}

export default async function (params: Record<string, unknown>) {
  const { agent_name } = params as GetAgentParams;

  if (!agent_name) {
    throw new Error("Missing required parameter: agent_name");
  }

  try {
    const result = await callBridgeTool("admin_get_agent_config", { agent_name });
    return result;
  } catch (error) {
    console.error("[orchestrator/admin/agents_get] Error:", error);
    throw error;
  }
}
