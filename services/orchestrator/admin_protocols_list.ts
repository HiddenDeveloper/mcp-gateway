/**
 * List Protocols (Admin)
 *
 * List all protocol definitions.
 */

import { callBridgeTool } from "./lib/config";

export default async function (_params: Record<string, unknown>) {
  try {
    const result = await callBridgeTool("admin_list_protocols", {});
    return result;
  } catch (error) {
    console.error("[orchestrator/admin/protocols_list] Error:", error);
    throw error;
  }
}
