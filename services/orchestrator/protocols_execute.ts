/**
 * Execute Protocol
 *
 * Execute a multi-agent workflow by name.
 * Supports sync (blocking) and async (job-based) execution.
 */

import { callBridgeTool, type ExecuteProtocolParams } from "./lib/config";

export default async function (params: Record<string, unknown>) {
  const { protocol_name, input, async: isAsync } = params as ExecuteProtocolParams;

  if (!protocol_name) {
    throw new Error("Missing required parameter: protocol_name");
  }

  try {
    const result = await callBridgeTool("execute_protocol", {
      protocol_name,
      input: input || {},
      ...(isAsync !== undefined && { async: isAsync }),
    });
    return result;
  } catch (error) {
    console.error("[orchestrator/protocols/execute] Error:", error);
    throw error;
  }
}
