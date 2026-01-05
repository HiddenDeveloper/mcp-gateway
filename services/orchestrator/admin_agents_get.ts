/**
 * Get Agent Config (Admin)
 *
 * Get full agent configuration with all details.
 *
 * Standalone implementation - no external dependencies.
 */

import { getAgent, buildAgentDetails } from "./lib/agent-loader";

interface GetAgentParams {
  agent_name: string;
}

export default async function (params: Record<string, unknown>) {
  const { agent_name } = params as GetAgentParams;

  if (!agent_name) {
    throw new Error("Missing required parameter: agent_name");
  }

  try {
    const agent = await getAgent(agent_name);

    if (!agent) {
      return {
        error: `Agent not found: ${agent_name}`,
      };
    }

    // Return full config including raw config for admin view
    const details = buildAgentDetails(agent_name, agent);

    return {
      ...details,
      raw_config: agent,
    };
  } catch (error) {
    console.error("[orchestrator/admin/agents_get] Error:", error);
    throw error;
  }
}
