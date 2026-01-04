/**
 * Reload Agents
 *
 * Reload agent configurations from disk.
 */

import { callBridgeTool } from "./lib/config";

export default async function (_params: Record<string, unknown>) {
  try {
    const result = await callBridgeTool("admin_reload_agents", {});
    return result;
  } catch (error) {
    console.error("[orchestrator/admin/agents_reload] Error:", error);
    throw error;
  }
}
