/**
 * Update Protocol (Admin)
 *
 * Update an existing protocol definition.
 *
 * Standalone implementation - no external dependencies.
 */

import { updateProtocol } from "./lib/protocol-executor";

interface UpdateProtocolParams {
  protocol_name: string;
  description?: string;
  phases?: Array<{
    name: string;
    description?: string;
    steps: Array<{
      name: string;
      tool: string;
      arguments: Record<string, unknown>;
      output_key?: string;
    }>;
  }>;
}

export default async function (params: Record<string, unknown>) {
  const { protocol_name, ...updates } = params as UpdateProtocolParams;

  if (!protocol_name) {
    throw new Error("Missing required parameter: protocol_name");
  }

  try {
    const updated = await updateProtocol(protocol_name, {
      ...(updates.description && {
        metadata: { name: protocol_name, version: "1.0.0", description: updates.description },
      }),
      ...(updates.phases && { phases: updates.phases }),
    });

    return {
      status: "updated",
      protocol_name,
      metadata: updated.metadata,
    };
  } catch (error) {
    console.error("[orchestrator/admin/protocols_update] Error:", error);
    throw error;
  }
}
