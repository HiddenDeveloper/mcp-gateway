/**
 * Reload Agents (Admin)
 *
 * Force reload agent configurations from disk.
 *
 * Standalone implementation - no external dependencies.
 */

import { reloadAgents, getAgents } from "./lib/agent-loader";

export default async function (_params: Record<string, unknown>) {
  try {
    await reloadAgents();
    const agents = await getAgents();

    return {
      status: "reloaded",
      agents_count: agents.size,
      message: `Reloaded ${agents.size} agent configurations`,
    };
  } catch (error) {
    console.error("[orchestrator/admin/agents_reload] Error:", error);
    throw error;
  }
}
