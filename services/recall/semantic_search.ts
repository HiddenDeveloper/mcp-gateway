/**
 * Semantic Search
 *
 * Find conversations by meaning using vector similarity.
 * Uses multilingual-e5-large embeddings for semantic matching.
 * Direct Qdrant access - standalone implementation.
 */

import { getQdrantService } from "./lib/qdrant-service";
import { generateEmbedding } from "./lib/embedding-utils";
import type { SemanticSearchParams } from "./lib/config";

export default async function (params: Record<string, unknown>) {
  const {
    query,
    limit = 10,
    threshold = 0.7,
    filters,
  } = params as SemanticSearchParams;

  if (!query) {
    throw new Error("Missing required parameter: query");
  }

  try {
    console.log(`[recall/semantic_search] Searching for: "${query}"`);

    // Generate embedding for search query
    const vector = await generateEmbedding(query);

    // Perform vector search
    const qdrant = getQdrantService();
    const results = await qdrant.semanticSearch(vector, limit, threshold, filters);

    console.log(`[recall/semantic_search] Found ${results.length} matches`);

    return {
      query,
      results,
      count: results.length,
      limit,
      threshold,
    };
  } catch (error) {
    console.error("[recall/semantic_search] Error:", error);
    throw error;
  }
}
