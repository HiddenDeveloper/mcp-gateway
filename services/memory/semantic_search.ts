/**
 * Semantic Search
 *
 * Searches memory using vector similarity.
 */

import { getNeo4jService } from "./lib/config";

interface Params {
  query: string;
  limit?: number;
  threshold?: number;
  node_types?: string[];
}

export default async function(params: Record<string, unknown>) {
  const { query, limit = 10, threshold = 0.7, node_types } = params as Params;

  if (!query) {
    throw new Error("Missing required parameter: query");
  }

  const service = getNeo4jService();

  try {
    await service.verifyConnection();

    const targetLabels = node_types || ["KnowledgeItem"];
    const results = await service.semanticSearch(
      query,
      targetLabels,
      "embedding_vectors",
      limit
    );

    // Filter by threshold
    const filteredResults = results.filter(
      (result: { score: number }) => result.score >= threshold
    );

    if (filteredResults.length === 0) {
      return {
        matches: [],
        message: `No memories found for query: "${query}" with similarity threshold ${threshold}`,
        suggestions: [
          "Try a lower threshold",
          "Try different search terms",
          "Consider if this concept needs to be stored in memory"
        ]
      };
    }

    // Format results (remove embeddings from response)
    const formattedResults = filteredResults.map(
      (result: Record<string, unknown>, index: number) => {
        const { embeddings, score, ...properties } = result;
        return {
          rank: index + 1,
          score: typeof score === "number" ? score.toFixed(3) : score,
          properties,
        };
      }
    );

    return {
      matches: formattedResults,
      count: formattedResults.length,
      query,
      threshold,
    };
  } catch (error) {
    console.error("[semantic_search] Error:", error);
    throw error;
  }
}
