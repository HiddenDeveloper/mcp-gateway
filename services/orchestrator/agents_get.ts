/**
 * Agents Get
 *
 * Get detailed information about a specific agent.
 * Tier 2 discovery - shows full agent configuration and tools.
 */

import { getAgent, buildAgentDetails } from "./lib/agent-loader";
import type { AgentsGetParams } from "./lib/types";

export default async function (params: Record<string, unknown>) {
  const { agent_name } = params as AgentsGetParams;

  if (!agent_name) {
    throw new Error("Missing required parameter: agent_name");
  }

  try {
    const agent = await getAgent(agent_name);

    if (!agent) {
      return {
        error: `Agent not found: ${agent_name}`,
        available_agents: "Use agents_list to see available agents",
      };
    }

    const details = buildAgentDetails(agent_name, agent);

    console.log(`[orchestrator/agents_get] Returning details for: ${agent_name}`);

    return details;
  } catch (error) {
    console.error("[orchestrator/agents_get] Error:", error);
    throw error;
  }
}
