/**
 * Text Search
 *
 * Keyword-based search in conversation metadata.
 * No embeddings required - searches text fields directly.
 * Direct Qdrant access - standalone implementation.
 */

import { getQdrantService } from "./lib/qdrant-service";
import type { TextSearchParams } from "./lib/config";

export default async function (params: Record<string, unknown>) {
  const {
    query,
    limit = 10,
    fields = ["text", "conversation_title"],
    provider,
    date_from,
    date_to,
  } = params as TextSearchParams;

  if (!query) {
    throw new Error("Missing required parameter: query");
  }

  try {
    console.log(`[recall/text_search] Searching for: "${query}"`);

    const qdrant = getQdrantService();
    const results = await qdrant.textSearch(
      query,
      limit,
      fields,
      provider,
      date_from,
      date_to
    );

    console.log(`[recall/text_search] Found ${results.length} matches`);

    return {
      query,
      results,
      count: results.length,
      limit,
      fields,
      ...(provider && { provider }),
      ...(date_from && { date_from }),
      ...(date_to && { date_to }),
    };
  } catch (error) {
    console.error("[recall/text_search] Error:", error);
    throw error;
  }
}
