/**
 * Update Protocol (Admin)
 *
 * Update an existing protocol definition.
 */

import { callBridgeTool } from "./lib/config";

interface UpdateProtocolParams {
  protocol_name: string;
  description?: string;
  steps?: Array<{
    agent: string;
    instruction: string;
    output_key?: string;
  }>;
}

export default async function (params: Record<string, unknown>) {
  const { protocol_name, ...updates } = params as UpdateProtocolParams;

  if (!protocol_name) {
    throw new Error("Missing required parameter: protocol_name");
  }

  try {
    const result = await callBridgeTool("admin_update_protocol", {
      protocol_name,
      ...updates,
    });
    return result;
  } catch (error) {
    console.error("[orchestrator/admin/protocols_update] Error:", error);
    throw error;
  }
}
