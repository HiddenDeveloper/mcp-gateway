/**
 * Semantic Search
 *
 * Find conversations by meaning using vector similarity.
 * Uses multilingual-e5-large embeddings for semantic matching.
 */

import { callRecallTool } from "./lib/config";
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
    const result = await callRecallTool("semantic_search", {
      query,
      limit,
      threshold,
      filters,
    });
    return result;
  } catch (error) {
    console.error("[recall/semantic_search] Error:", error);
    throw error;
  }
}
