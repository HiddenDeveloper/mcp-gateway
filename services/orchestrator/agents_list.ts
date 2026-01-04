/**
 * Agents List
 *
 * List all available agents with capability summaries.
 * Tier 1 discovery - shows agent overview with tool counts.
 */

import { listAgentSummaries } from "./lib/agent-loader";
import type { AgentsListParams } from "./lib/types";

export default async function (params: Record<string, unknown>) {
  const { mcp_server, limit } = params as AgentsListParams;

  try {
    const agents = await listAgentSummaries(mcp_server, limit);

    console.log(`[orchestrator/agents_list] Returning ${agents.length} agents`);

    return {
      agents,
      count: agents.length,
      ...(mcp_server && { filtered_by: mcp_server }),
      ...(limit && { limit }),
    };
  } catch (error) {
    console.error("[orchestrator/agents_list] Error:", error);
    throw error;
  }
}
