/**
 * List Agent Configs (Admin)
 *
 * List all agent configurations with full details.
 *
 * Standalone implementation - no external dependencies.
 */

import { getAgents, buildAgentDetails } from "./lib/agent-loader";

export default async function (_params: Record<string, unknown>) {
  try {
    const agents = await getAgents();
    const agentList = [];

    for (const [key, agent] of agents) {
      agentList.push(buildAgentDetails(key, agent));
    }

    // Sort by name
    agentList.sort((a, b) => a.name.localeCompare(b.name));

    return {
      agents: agentList,
      count: agentList.length,
    };
  } catch (error) {
    console.error("[orchestrator/admin/agents_list] Error:", error);
    throw error;
  }
}
