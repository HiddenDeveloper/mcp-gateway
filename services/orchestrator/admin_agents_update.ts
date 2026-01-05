/**
 * Update Agent (Admin)
 *
 * Update an existing agent configuration.
 *
 * Standalone implementation - no external dependencies.
 */

import { updateAgent, buildAgentDetails } from "./lib/agent-loader";

interface UpdateAgentParams {
  agent_name: string;
  description?: string;
  system_prompt?: string;
  assigned_functions?: string[];
  assigned_agents?: string[];
  assigned_mcp_servers?: string[];
  protocol?: string;
}

export default async function (params: Record<string, unknown>) {
  const { agent_name, ...updates } = params as UpdateAgentParams;

  if (!agent_name) {
    throw new Error("Missing required parameter: agent_name");
  }

  try {
    const agent = await updateAgent(agent_name, updates);

    return {
      status: "updated",
      agent: buildAgentDetails(agent_name, agent),
    };
  } catch (error) {
    console.error("[orchestrator/admin/agents_update] Error:", error);
    throw error;
  }
}
