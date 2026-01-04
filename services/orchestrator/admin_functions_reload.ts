/**
 * Reload Functions
 *
 * Reload functions from disk.
 */

import { callBridgeTool } from "./lib/config";

export default async function (_params: Record<string, unknown>) {
  try {
    const result = await callBridgeTool("admin_reload_functions", {});
    return result;
  } catch (error) {
    console.error("[orchestrator/admin/functions_reload] Error:", error);
    throw error;
  }
}
