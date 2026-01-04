/**
 * Get Protocol (Admin)
 *
 * Get a protocol definition.
 */

import { callBridgeTool } from "./lib/config";

interface GetProtocolParams {
  protocol_name: string;
}

export default async function (params: Record<string, unknown>) {
  const { protocol_name } = params as GetProtocolParams;

  if (!protocol_name) {
    throw new Error("Missing required parameter: protocol_name");
  }

  try {
    const result = await callBridgeTool("admin_get_protocol", { protocol_name });
    return result;
  } catch (error) {
    console.error("[orchestrator/admin/protocols_get] Error:", error);
    throw error;
  }
}
