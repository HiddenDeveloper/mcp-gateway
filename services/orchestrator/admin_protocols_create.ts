/**
 * Create Protocol (Admin)
 *
 * Create a new protocol definition.
 *
 * Standalone implementation - no external dependencies.
 */

import { createProtocol, type Protocol } from "./lib/protocol-executor";

interface CreateProtocolParams {
  name: string;
  version?: string;
  description?: string;
  phases: Array<{
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
  const { name, version, description, phases } = params as CreateProtocolParams;

  if (!name) {
    throw new Error("Missing required parameter: name");
  }
  if (!phases || !Array.isArray(phases)) {
    throw new Error("Missing required parameter: phases (array)");
  }

  try {
    const protocol: Protocol = {
      metadata: {
        name,
        version: version || "1.0.0",
        description,
      },
      phases,
    };

    await createProtocol(protocol);

    return {
      status: "created",
      protocol_name: name,
    };
  } catch (error) {
    console.error("[orchestrator/admin/protocols_create] Error:", error);
    throw error;
  }
}
