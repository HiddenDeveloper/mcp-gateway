/**
 * Delete Agent
 *
 * Delete an agent configuration.
 */

import { callBridgeTool } from "./lib/config";

interface DeleteAgentParams {
  agent_name: string;
}

export default async function (params: Record<string, unknown>) {
  const { agent_name } = params as DeleteAgentParams;

  if (!agent_name) {
    throw new Error("Missing required parameter: agent_name");
  }

  try {
    const result = await callBridgeTool("admin_delete_agent", { agent_name });
    return result;
  } catch (error) {
    console.error("[orchestrator/admin/agents_delete] Error:", error);
    throw error;
  }
}
