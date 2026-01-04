/**
 * Text Search
 *
 * Full-text search with optional fuzzy matching.
 */

import { getNeo4jService } from "./lib/config";

interface Params {
  query: string;
  node_types?: string[];
  properties?: string[];
  fuzzy?: boolean;
  limit?: number;
}

export default async function(params: Record<string, unknown>) {
  const {
    query,
    node_types = [],
    properties = [],
    fuzzy = false,
    limit = 10,
  } = params as Params;

  if (!query) {
    throw new Error("Missing required parameter: query");
  }

  const service = getNeo4jService();

  try {
    await service.verifyConnection();

    const results = await service.textSearch(
      query,
      node_types,
      properties,
      fuzzy,
      limit
    );

    if (results.length === 0) {
      return {
        matches: [],
        message: `No results found for query: "${query}"`,
      };
    }

    // Format results
    const formattedResults = results.map(
      (result: { n: { properties: Record<string, unknown> } }, index: number) => ({
        rank: index + 1,
        properties: result.n?.properties || result,
      })
    );

    return {
      matches: formattedResults,
      count: formattedResults.length,
      query,
    };
  } catch (error) {
    console.error("[text_search] Error:", error);
    throw error;
  }
}
