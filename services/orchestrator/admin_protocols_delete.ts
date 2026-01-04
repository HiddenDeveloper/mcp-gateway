/**
 * Delete Protocol (Admin)
 *
 * Delete a protocol definition.
 */

import { callBridgeTool } from "./lib/config";

interface DeleteProtocolParams {
  protocol_name: string;
}

export default async function (params: Record<string, unknown>) {
  const { protocol_name } = params as DeleteProtocolParams;

  if (!protocol_name) {
    throw new Error("Missing required parameter: protocol_name");
  }

  try {
    const result = await callBridgeTool("admin_delete_protocol", { protocol_name });
    return result;
  } catch (error) {
    console.error("[orchestrator/admin/protocols_delete] Error:", error);
    throw error;
  }
}
