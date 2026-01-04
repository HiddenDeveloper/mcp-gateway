/**
 * Create Protocol (Admin)
 *
 * Create a new protocol definition.
 */

import { callBridgeTool } from "./lib/config";

interface CreateProtocolParams {
  name: string;
  description: string;
  steps: Array<{
    agent: string;
    instruction: string;
    output_key?: string;
  }>;
}

export default async function (params: Record<string, unknown>) {
  const { name, description, steps } = params as CreateProtocolParams;

  if (!name) {
    throw new Error("Missing required parameter: name");
  }
  if (!description) {
    throw new Error("Missing required parameter: description");
  }
  if (!steps || !Array.isArray(steps)) {
    throw new Error("Missing required parameter: steps (array)");
  }

  try {
    const result = await callBridgeTool("admin_create_protocol", {
      name,
      description,
      steps,
    });
    return result;
  } catch (error) {
    console.error("[orchestrator/admin/protocols_create] Error:", error);
    throw error;
  }
}
