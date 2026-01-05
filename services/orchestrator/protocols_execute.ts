/**
 * Execute Protocol
 *
 * Execute a multi-agent workflow by name.
 * Supports sync (blocking) and async (job-based) execution.
 *
 * Standalone implementation - no external dependencies.
 */

import {
  loadProtocol,
  executeProtocol,
  executeProtocolAsync,
} from "./lib/protocol-executor";
import type { ProtocolsExecuteParams } from "./lib/types";

export default async function (params: Record<string, unknown>) {
  const {
    protocol_name,
    variables,
    async: isAsync,
  } = params as ProtocolsExecuteParams;

  if (!protocol_name) {
    throw new Error("Missing required parameter: protocol_name");
  }

  try {
    // Load protocol (adds .yaml extension if not present)
    const protocolPath = protocol_name.includes(".")
      ? protocol_name
      : `${protocol_name}.yaml`;

    const protocol = await loadProtocol(protocolPath);

    if (isAsync) {
      // Async execution - return job ID immediately
      const jobId = await executeProtocolAsync(protocol, variables);

      return {
        status: "started",
        job_id: jobId,
        protocol_name: protocol.metadata.name,
        message: "Protocol execution started. Use protocols_status to check progress.",
      };
    }

    // Sync execution - wait for completion
    const result = await executeProtocol(protocol, variables);

    return {
      status: result.status,
      protocol_name: result.protocol,
      duration_ms: result.duration_ms,
      phases_completed: result.phases_completed,
      steps_completed: result.steps_completed,
      results: result.results,
      ...(result.error && { error: result.error }),
    };
  } catch (error) {
    console.error("[orchestrator/protocols/execute] Error:", error);
    throw error;
  }
}
