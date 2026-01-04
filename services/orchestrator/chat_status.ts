/**
 * Ailumina Status
 *
 * Get the status of the Ailumina orchestration system.
 */

import { callBridgeTool } from "./lib/config";

export default async function (_params: Record<string, unknown>) {
  try {
    const result = await callBridgeTool("ailumina_status", {});
    return result;
  } catch (error) {
    console.error("[orchestrator/chat/status] Error:", error);
    throw error;
  }
}
