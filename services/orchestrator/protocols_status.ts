/**
 * Get Protocol Job Status
 *
 * Check the status of an async protocol execution.
 *
 * Standalone implementation - no external dependencies.
 */

import { getJob, listJobs } from "./lib/protocol-executor";

interface GetJobStatusParams {
  job_id: string;
}

export default async function (params: Record<string, unknown>) {
  const { job_id } = params as GetJobStatusParams;

  if (!job_id) {
    // Return list of all jobs if no job_id specified
    const jobs = listJobs();
    return {
      jobs: jobs.map(j => ({
        id: j.id,
        protocol_name: j.protocol_name,
        status: j.status,
        started_at: j.started_at.toISOString(),
        completed_at: j.completed_at?.toISOString(),
      })),
      count: jobs.length,
    };
  }

  try {
    const job = getJob(job_id);

    if (!job) {
      return {
        error: `Job not found: ${job_id}`,
        available_jobs: listJobs().map(j => j.id),
      };
    }

    return {
      job_id: job.id,
      protocol_name: job.protocol_name,
      status: job.status,
      started_at: job.started_at.toISOString(),
      completed_at: job.completed_at?.toISOString(),
      duration_ms: job.completed_at
        ? job.completed_at.getTime() - job.started_at.getTime()
        : Date.now() - job.started_at.getTime(),
      current_phase: job.current_phase,
      current_step: job.current_step,
      results: job.results,
      ...(job.error && { error: job.error }),
    };
  } catch (error) {
    console.error("[orchestrator/protocols_status] Error:", error);
    throw error;
  }
}
