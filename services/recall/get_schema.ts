/**
 * Get Schema
 *
 * View collection metadata and available filters for conversation history search.
 * Direct Qdrant access - standalone implementation.
 */

import { getQdrantService } from "./lib/qdrant-service";
import type { SchemaParams } from "./lib/config";

export default async function (params: Record<string, unknown>) {
  const { include_statistics = true } = params as SchemaParams;

  try {
    const qdrant = getQdrantService();
    const schema = await qdrant.getCollectionInfo(include_statistics);

    console.log("[recall/get_schema] Schema retrieved successfully");
    return schema;
  } catch (error) {
    console.error("[recall/get_schema] Error:", error);
    throw error;
  }
}
