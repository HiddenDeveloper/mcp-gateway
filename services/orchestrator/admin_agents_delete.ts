/**
 * Delete Agent (Admin)
 *
 * Delete an agent configuration.
 *
 * Standalone implementation - no external dependencies.
 */

import { deleteAgent } from "./lib/agent-loader";

interface DeleteAgentParams {
  agent_name: string;
}

export default async function (params: Record<string, unknown>) {
  const { agent_name } = params as DeleteAgentParams;

  if (!agent_name) {
    throw new Error("Missing required parameter: agent_name");
  }

  try {
    await deleteAgent(agent_name);

    return {
      status: "deleted",
      agent_name,
    };
  } catch (error) {
    console.error("[orchestrator/admin/agents_delete] Error:", error);
    throw error;
  }
}
