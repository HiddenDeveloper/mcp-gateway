/**
 * Text Search
 *
 * Keyword-based search in conversation metadata.
 * No embeddings required - searches text fields directly.
 */

import { callRecallTool } from "./lib/config";
import type { TextSearchParams } from "./lib/config";

export default async function (params: Record<string, unknown>) {
  const {
    query,
    limit = 10,
    fields,
    provider,
    date_from,
    date_to,
  } = params as TextSearchParams;

  if (!query) {
    throw new Error("Missing required parameter: query");
  }

  try {
    const result = await callRecallTool("text_search", {
      query,
      limit,
      fields,
      provider,
      date_from,
      date_to,
    });
    return result;
  } catch (error) {
    console.error("[recall/text_search] Error:", error);
    throw error;
  }
}
