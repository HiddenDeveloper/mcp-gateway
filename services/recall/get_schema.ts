/**
 * Get Schema
 *
 * View collection metadata and available filters for conversation history search.
 */

import { callRecallTool } from "./lib/config";
import type { SchemaParams } from "./lib/config";

export default async function (params: Record<string, unknown>) {
  const { include_statistics = true } = params as SchemaParams;

  try {
    const result = await callRecallTool("get_schema", { include_statistics });
    return result;
  } catch (error) {
    console.error("[recall/get_schema] Error:", error);
    throw error;
  }
}
