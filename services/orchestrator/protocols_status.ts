/**
 * Get Protocol Job Status
 *
 * Check the status of an async protocol execution.
 */

import { callBridgeTool, type GetJobStatusParams } from "./lib/config";

export default async function (params: Record<string, unknown>) {
  const { job_id } = params as GetJobStatusParams;

  if (!job_id) {
    throw new Error("Missing required parameter: job_id");
  }

  try {
    const result = await callBridgeTool("get_protocol_job_status", { job_id });
    return result;
  } catch (error) {
    console.error("[orchestrator/protocols/status] Error:", error);
    throw error;
  }
}
