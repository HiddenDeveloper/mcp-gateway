/**
 * Get Protocol (Admin)
 *
 * Get a protocol definition with full details.
 *
 * Standalone implementation - no external dependencies.
 */

import { loadProtocol } from "./lib/protocol-executor";

interface GetProtocolParams {
  protocol_name: string;
}

export default async function (params: Record<string, unknown>) {
  const { protocol_name } = params as GetProtocolParams;

  if (!protocol_name) {
    throw new Error("Missing required parameter: protocol_name");
  }

  try {
    // Add extension if not present
    const protocolPath = protocol_name.includes(".")
      ? protocol_name
      : `${protocol_name}.yaml`;

    const protocol = await loadProtocol(protocolPath);

    return {
      metadata: protocol.metadata,
      variables: protocol.variables,
      phases: protocol.phases.map(phase => ({
        name: phase.name,
        description: phase.description,
        steps_count: phase.steps.length,
        steps: phase.steps.map(step => ({
          name: step.name,
          tool: step.tool,
          output_key: step.output_key,
        })),
      })),
    };
  } catch (error) {
    console.error("[orchestrator/admin/protocols_get] Error:", error);
    throw error;
  }
}
