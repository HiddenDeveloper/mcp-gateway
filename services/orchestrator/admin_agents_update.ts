/**
 * Update Agent
 *
 * Update an existing agent configuration.
 */

import { callBridgeTool } from "./lib/config";

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
    const result = await callBridgeTool("admin_update_agent", {
      agent_name,
      ...updates,
    });
    return result;
  } catch (error) {
    console.error("[orchestrator/admin/agents_update] Error:", error);
    throw error;
  }
}
