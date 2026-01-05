/**
 * Protocol Executor
 *
 * Executes multi-step workflows defined in YAML/JSON protocol files.
 * Standalone implementation - no external dependencies.
 */

import { readFile, readdir, writeFile, unlink } from "fs/promises";
import { join, extname } from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { callGatewayTool, PROTOCOLS_PATH } from "./config";

// ============================================================================
// Types
// ============================================================================

export interface ProtocolStep {
  name: string;
  description?: string;
  tool: string;
  arguments: Record<string, unknown>;
  output_key?: string;
  condition?: string;
  on_error?: "continue" | "abort" | "retry";
  max_retries?: number;
}

export interface ProtocolPhase {
  name: string;
  description?: string;
  steps: ProtocolStep[];
}

export interface ProtocolMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  tags?: string[];
  category?: string;
}

export interface Protocol {
  metadata: ProtocolMetadata;
  variables?: Record<string, unknown>;
  phases: ProtocolPhase[];
}

export interface ProtocolJob {
  id: string;
  protocol_name: string;
  status: "pending" | "running" | "completed" | "failed";
  started_at: Date;
  completed_at?: Date;
  current_phase?: string;
  current_step?: string;
  results: Record<string, unknown>;
  error?: string;
}

export interface ExecutionResult {
  status: "completed" | "failed" | "aborted";
  protocol: string;
  duration_ms: number;
  phases_completed: number;
  steps_completed: number;
  results: Record<string, unknown>;
  error?: string;
}

// ============================================================================
// Job Store (in-memory)
// ============================================================================

const jobStore = new Map<string, ProtocolJob>();

function generateJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function getJob(jobId: string): ProtocolJob | undefined {
  return jobStore.get(jobId);
}

export function listJobs(): ProtocolJob[] {
  return Array.from(jobStore.values());
}

// ============================================================================
// Protocol Loader
// ============================================================================

/**
 * Load a protocol from file
 */
export async function loadProtocol(protocolPath: string): Promise<Protocol> {
  // Resolve path relative to PROTOCOLS_PATH if not absolute
  const fullPath = protocolPath.startsWith("/")
    ? protocolPath
    : join(PROTOCOLS_PATH, protocolPath);

  console.log(`[ProtocolLoader] Loading: ${fullPath}`);

  const content = await readFile(fullPath, "utf-8");
  const ext = extname(fullPath).toLowerCase();

  let protocol: Protocol;

  if (ext === ".yaml" || ext === ".yml") {
    protocol = parseYaml(content) as Protocol;
  } else if (ext === ".json") {
    protocol = JSON.parse(content) as Protocol;
  } else {
    throw new Error(`Unsupported protocol format: ${ext}`);
  }

  // Validate required fields
  if (!protocol.metadata?.name) {
    throw new Error("Protocol missing required field: metadata.name");
  }
  if (!protocol.phases || protocol.phases.length === 0) {
    throw new Error("Protocol must have at least one phase");
  }

  return protocol;
}

/**
 * List available protocols
 */
export async function listProtocols(): Promise<ProtocolMetadata[]> {
  try {
    const files = await readdir(PROTOCOLS_PATH);
    const protocols: ProtocolMetadata[] = [];

    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if (ext === ".yaml" || ext === ".yml" || ext === ".json") {
        try {
          const protocol = await loadProtocol(file);
          protocols.push(protocol.metadata);
        } catch (err) {
          console.warn(`[ProtocolLoader] Skipping invalid protocol: ${file}`);
        }
      }
    }

    return protocols;
  } catch (err) {
    // Directory doesn't exist yet
    console.warn(`[ProtocolLoader] Protocols directory not found: ${PROTOCOLS_PATH}`);
    return [];
  }
}

// ============================================================================
// Template Engine (simple variable interpolation)
// ============================================================================

/**
 * Interpolate variables in a string
 * Supports: {{variable}}, {{variable.nested}}, {{$results.step_output}}
 */
function interpolate(
  template: string,
  variables: Record<string, unknown>,
  results: Record<string, unknown>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const trimmedPath = path.trim();

    // Handle $results references
    if (trimmedPath.startsWith("$results.")) {
      const resultKey = trimmedPath.substring(9);
      return String(getNestedValue(results, resultKey) ?? match);
    }

    // Handle regular variables
    return String(getNestedValue(variables, trimmedPath) ?? match);
  });
}

/**
 * Get nested value from object by dot-notation path
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Interpolate all string values in an object recursively
 */
function interpolateObject(
  obj: unknown,
  variables: Record<string, unknown>,
  results: Record<string, unknown>
): unknown {
  if (typeof obj === "string") {
    return interpolate(obj, variables, results);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => interpolateObject(item, variables, results));
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value, variables, results);
    }
    return result;
  }

  return obj;
}

// ============================================================================
// Protocol Executor
// ============================================================================

/**
 * Execute a protocol synchronously
 */
export async function executeProtocol(
  protocol: Protocol,
  inputVariables?: Record<string, unknown>
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const variables = { ...protocol.variables, ...inputVariables };
  const results: Record<string, unknown> = {};

  let phasesCompleted = 0;
  let stepsCompleted = 0;

  console.log(`[ProtocolExecutor] Starting: ${protocol.metadata.name}`);

  try {
    for (const phase of protocol.phases) {
      console.log(`[ProtocolExecutor] Phase: ${phase.name}`);

      for (const step of phase.steps) {
        console.log(`[ProtocolExecutor] Step: ${step.name} -> ${step.tool}`);

        // Interpolate arguments
        const args = interpolateObject(step.arguments, variables, results) as Record<string, unknown>;

        // Execute tool
        let retries = 0;
        const maxRetries = step.max_retries ?? 0;
        let lastError: Error | undefined;

        while (retries <= maxRetries) {
          try {
            const result = await callGatewayTool(step.tool, args);

            // Store result if output_key specified
            if (step.output_key) {
              results[step.output_key] = result;
            }

            stepsCompleted++;
            break;
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            console.error(`[ProtocolExecutor] Step failed: ${step.name}`, err);

            if (step.on_error === "abort") {
              throw lastError;
            }

            if (step.on_error === "continue") {
              break;
            }

            // Retry
            retries++;
            if (retries > maxRetries) {
              throw lastError;
            }

            console.log(`[ProtocolExecutor] Retrying (${retries}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          }
        }
      }

      phasesCompleted++;
    }

    const duration = Date.now() - startTime;
    console.log(`[ProtocolExecutor] Completed: ${protocol.metadata.name} (${duration}ms)`);

    return {
      status: "completed",
      protocol: protocol.metadata.name,
      duration_ms: duration,
      phases_completed: phasesCompleted,
      steps_completed: stepsCompleted,
      results,
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    const error = err instanceof Error ? err.message : String(err);

    console.error(`[ProtocolExecutor] Failed: ${protocol.metadata.name}`, err);

    return {
      status: "failed",
      protocol: protocol.metadata.name,
      duration_ms: duration,
      phases_completed: phasesCompleted,
      steps_completed: stepsCompleted,
      results,
      error,
    };
  }
}

/**
 * Execute a protocol asynchronously (returns job ID immediately)
 */
export async function executeProtocolAsync(
  protocol: Protocol,
  inputVariables?: Record<string, unknown>
): Promise<string> {
  const jobId = generateJobId();

  const job: ProtocolJob = {
    id: jobId,
    protocol_name: protocol.metadata.name,
    status: "running",
    started_at: new Date(),
    results: {},
  };

  jobStore.set(jobId, job);

  // Execute in background
  executeProtocol(protocol, inputVariables)
    .then(result => {
      job.status = result.status === "completed" ? "completed" : "failed";
      job.completed_at = new Date();
      job.results = result.results;
      if (result.error) {
        job.error = result.error;
      }
    })
    .catch(err => {
      job.status = "failed";
      job.completed_at = new Date();
      job.error = err instanceof Error ? err.message : String(err);
    });

  return jobId;
}

// ============================================================================
// Protocol CRUD Operations
// ============================================================================

/**
 * Create a new protocol
 */
export async function createProtocol(protocol: Protocol): Promise<void> {
  const filename = `${protocol.metadata.name}.yaml`;
  const fullPath = join(PROTOCOLS_PATH, filename);

  // Check if already exists
  try {
    await readFile(fullPath);
    throw new Error(`Protocol already exists: ${protocol.metadata.name}`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }

  const content = stringifyYaml(protocol);
  await writeFile(fullPath, content, "utf-8");
  console.log(`[ProtocolLoader] Created: ${fullPath}`);
}

/**
 * Update an existing protocol
 */
export async function updateProtocol(
  name: string,
  updates: Partial<Protocol>
): Promise<Protocol> {
  // Load existing
  const protocol = await loadProtocol(`${name}.yaml`);

  // Merge updates
  const updated: Protocol = {
    ...protocol,
    ...updates,
    metadata: {
      ...protocol.metadata,
      ...updates.metadata,
      name, // Keep original name
    },
  };

  // Save
  const fullPath = join(PROTOCOLS_PATH, `${name}.yaml`);
  const content = stringifyYaml(updated);
  await writeFile(fullPath, content, "utf-8");
  console.log(`[ProtocolLoader] Updated: ${fullPath}`);

  return updated;
}

/**
 * Delete a protocol
 */
export async function deleteProtocol(name: string): Promise<void> {
  const fullPath = join(PROTOCOLS_PATH, `${name}.yaml`);

  try {
    await unlink(fullPath);
    console.log(`[ProtocolLoader] Deleted: ${fullPath}`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Protocol not found: ${name}`);
    }
    throw err;
  }
}
