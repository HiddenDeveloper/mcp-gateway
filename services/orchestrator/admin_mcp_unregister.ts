/**
 * Unregister MCP Server
 *
 * Remove an MCP server from the bridge.
 */

import { callBridgeTool } from "./lib/config";

interface UnregisterMCPParams {
  name: string;
}

export default async function (params: Record<string, unknown>) {
  const { name } = params as UnregisterMCPParams;

  if (!name) {
    throw new Error("Missing required parameter: name");
  }

  try {
    const result = await callBridgeTool("admin_unregister_mcp_server", { name });
    return result;
  } catch (error) {
    console.error("[orchestrator/admin/mcp_unregister] Error:", error);
    throw error;
  }
}
