/**
 * Register MCP Server
 *
 * Register a new MCP server with the bridge.
 */

import { callBridgeTool } from "./lib/config";

interface RegisterMCPParams {
  name: string;
  url: string;
  bearer_token?: string;
  transport?: "sse" | "streamablehttp";
}

export default async function (params: Record<string, unknown>) {
  const { name, url, bearer_token, transport } = params as RegisterMCPParams;

  if (!name) {
    throw new Error("Missing required parameter: name");
  }
  if (!url) {
    throw new Error("Missing required parameter: url");
  }

  try {
    const result = await callBridgeTool("admin_register_mcp_server", {
      name,
      url,
      ...(bearer_token && { bearer_token }),
      ...(transport && { transport }),
    });
    return result;
  } catch (error) {
    console.error("[orchestrator/admin/mcp_register] Error:", error);
    throw error;
  }
}
