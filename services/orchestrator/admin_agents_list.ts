/**
 * List Agent Configs
 *
 * List all agent configurations (admin view).
 */

import { callBridgeTool } from "./lib/config";

export default async function (_params: Record<string, unknown>) {
  try {
    const result = await callBridgeTool("admin_list_agent_configs", {});
    return result;
  } catch (error) {
    console.error("[orchestrator/admin/agents_list] Error:", error);
    throw error;
  }
}
