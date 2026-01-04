/**
 * Agents Search
 *
 * Search for agents by query string with optional fuzzy matching.
 */

import { callBridgeTool, type AgentsSearchParams } from "./lib/config";

export default async function (params: Record<string, unknown>) {
  const { query, limit, fuzzy } = params as AgentsSearchParams;

  if (!query) {
    throw new Error("Missing required parameter: query");
  }

  try {
    const result = await callBridgeTool("agents_search", {
      query,
      ...(limit && { limit }),
      ...(fuzzy !== undefined && { fuzzy }),
    });
    return result;
  } catch (error) {
    console.error("[orchestrator/agents/search] Error:", error);
    throw error;
  }
}
