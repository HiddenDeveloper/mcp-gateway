/**
 * List Functions
 *
 * List all registered functions in the bridge.
 */

import { callBridgeTool } from "./lib/config";

export default async function (_params: Record<string, unknown>) {
  try {
    const result = await callBridgeTool("admin_list_functions", {});
    return result;
  } catch (error) {
    console.error("[orchestrator/admin/functions_list] Error:", error);
    throw error;
  }
}
