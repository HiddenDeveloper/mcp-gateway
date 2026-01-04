/**
 * List MCP Servers
 *
 * List all registered MCP servers.
 */

import { callBridgeTool } from "./lib/config";

export default async function (_params: Record<string, unknown>) {
  try {
    const result = await callBridgeTool("admin_list_mcp_servers", {});
    return result;
  } catch (error) {
    console.error("[orchestrator/admin/mcp_list] Error:", error);
    throw error;
  }
}
