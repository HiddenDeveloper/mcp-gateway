/**
 * Delete Protocol (Admin)
 *
 * Delete a protocol definition.
 *
 * Standalone implementation - no external dependencies.
 */

import { deleteProtocol } from "./lib/protocol-executor";

interface DeleteProtocolParams {
  protocol_name: string;
}

export default async function (params: Record<string, unknown>) {
  const { protocol_name } = params as DeleteProtocolParams;

  if (!protocol_name) {
    throw new Error("Missing required parameter: protocol_name");
  }

  try {
    await deleteProtocol(protocol_name);

    return {
      status: "deleted",
      protocol_name,
    };
  } catch (error) {
    console.error("[orchestrator/admin/protocols_delete] Error:", error);
    throw error;
  }
}
