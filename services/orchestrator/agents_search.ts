/**
 * Agents Search
 *
 * Search for agents by name, description, or capabilities.
 * Supports fuzzy matching and returns relevance scores.
 */

import { getAgents, buildAgentSummary } from "./lib/agent-loader";
import type { AgentsSearchParams, AgentSearchResult } from "./lib/types";

/**
 * Simple fuzzy match - returns score 0-1
 */
function fuzzyMatch(text: string, query: string): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact match
  if (lowerText === lowerQuery) return 1.0;

  // Contains match
  if (lowerText.includes(lowerQuery)) return 0.8;

  // Word match
  const words = lowerText.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(lowerQuery)) return 0.7;
  }

  // Character overlap (basic fuzzy)
  let matches = 0;
  let queryIndex = 0;
  for (const char of lowerText) {
    if (queryIndex < lowerQuery.length && char === lowerQuery[queryIndex]) {
      matches++;
      queryIndex++;
    }
  }
  const overlapScore = queryIndex === lowerQuery.length ? matches / lowerText.length : 0;

  return overlapScore * 0.5;
}

export default async function (params: Record<string, unknown>) {
  const { query, limit = 10, fuzzy = true } = params as AgentsSearchParams;

  if (!query) {
    throw new Error("Missing required parameter: query");
  }

  try {
    const agents = await getAgents();
    const results: AgentSearchResult[] = [];

    for (const [key, agent] of agents) {
      const matchReasons: string[] = [];
      let score = 0;

      // Score name match (highest weight)
      const nameScore = fuzzyMatch(agent.name || key, query);
      if (nameScore > 0) {
        score += nameScore * 10;
        matchReasons.push("name");
      }

      // Score description match
      if (agent.description) {
        const descScore = fuzzyMatch(agent.description, query);
        if (descScore > 0) {
          score += descScore * 6;
          matchReasons.push("description");
        }
      }

      // Score MCP server match
      for (const server of agent.assigned_mcp_servers || []) {
        const serverScore = fuzzyMatch(server, query);
        if (serverScore > 0) {
          score += serverScore * 4;
          matchReasons.push(`mcp_server:${server}`);
        }
      }

      // Score protocol match
      const protocol = agent.protocol || agent.custom_settings?.protocol;
      if (protocol && typeof protocol === "string") {
        const protocolScore = fuzzyMatch(protocol, query);
        if (protocolScore > 0) {
          score += protocolScore * 3;
          matchReasons.push("protocol");
        }
      }

      // Bonus for tool count
      const totalTools =
        (agent.assigned_functions?.length || 0) +
        (agent.assigned_agents?.length || 0) +
        (agent.assigned_mcp_servers?.length || 0);
      score += Math.min(totalTools / 10, 1);

      if (score > 0 || !fuzzy) {
        const summary = buildAgentSummary(key, agent);
        results.push({
          ...summary,
          score: Math.round(score * 100) / 100,
          match_reasons: matchReasons,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    const limited = results.slice(0, limit);

    console.log(`[orchestrator/agents_search] Found ${limited.length} matches for: ${query}`);

    return {
      query,
      results: limited,
      count: limited.length,
      total_agents: agents.size,
    };
  } catch (error) {
    console.error("[orchestrator/agents_search] Error:", error);
    throw error;
  }
}
