/**
 * System Status
 *
 * Check Recall system health and Qdrant connection status.
 */

import { callRecallTool } from "./lib/config";

export default async function (_params: Record<string, unknown>) {
  try {
    const result = await callRecallTool("system_status", {});
    return result;
  } catch (error) {
    console.error("[recall/system_status] Error:", error);
    throw error;
  }
}
