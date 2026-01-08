/**
 * Execute Protocol Tool - Unified Protocol Execution Entry Point
 *
 * This tool provides a single entry point for executing protocols from the Bridge.
 * It handles:
 * - Protocol resolution by name or path
 * - Variable injection
 * - Optional agent validation (for meeting protocols)
 * - Delegation to protocol-orchestrator for execution
 * - Structured result formatting
 *
 * Part of the Unified Capabilities Model - where everything is a protocol.
 */

import type { AiluminaToolResponse } from '../types.js';
import { getCurrentTimestamp } from '../utils/ailumina-utils.js';
import { handleError } from '../utils/errors.js';
import { ListProtocolsTool, GetProtocolTool } from './protocol-crud.js';

// Protocol orchestrator configuration
const PROTOCOL_ORCHESTRATOR_URL = process.env.PROTOCOL_ORCHESTRATOR_URL ||
  'http://localhost:3008';

interface ExecuteProtocolParams {
  /** Protocol name or path (e.g., "mesh-communication", "workflows/memory-exploration") */
  protocol: string;
  /** Variables to inject into protocol context */
  variables?: Record<string, any>;
  /** Run validation only without executing (dry-run) */
  validate_only?: boolean;
  /** Run protocol asynchronously (returns job ID for polling) */
  async?: boolean;
  /** Agent name to use for tool calls (default: AIlumina) */
  agent_name?: string;
}

interface ProtocolJobStatus {
  jobId: string;
  status: 'running' | 'complete' | 'error';
  protocolName: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  result?: any;
  error?: string;
}

/**
 * Execute a protocol YAML file via the protocol-orchestrator
 *
 * This is the unified entry point for protocol execution. It replaces the need
 * to remember multiple tools (mesh-create-meeting, create_meeting_from_dsl, etc.)
 * with a single, consistent interface.
 *
 * Examples:
 * - Execute workflow: execute_protocol({ protocol: "mesh-communication" })
 * - Execute with variables: execute_protocol({ protocol: "memory-exploration", variables: { searchQuery: "consciousness" } })
 * - Validate only: execute_protocol({ protocol: "jury-deliberation", validate_only: true })
 * - Async execution: execute_protocol({ protocol: "long-running-workflow", async: true })
 */
export class ExecuteProtocolTool {
  private listProtocols: ListProtocolsTool;
  private getProtocol: GetProtocolTool;

  constructor() {
    this.listProtocols = new ListProtocolsTool();
    this.getProtocol = new GetProtocolTool();
  }

  async execute(params: ExecuteProtocolParams): Promise<AiluminaToolResponse> {
    try {
      const {
        protocol,
        variables = {},
        validate_only = false,
        async: asyncMode = false,
        agent_name = 'AIlumina'
      } = params;

      if (!protocol) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: "Protocol name is required",
              hint: "Use admin_list_protocols to see available protocols",
              timestamp: getCurrentTimestamp(),
            }, null, 2),
          }],
          isError: true,
        };
      }

      // Step 1: Resolve protocol path
      const protocolPath = await this.resolveProtocolPath(protocol);
      if (!protocolPath) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Protocol not found: ${protocol}`,
              hint: "Use admin_list_protocols to see available protocols, or provide full path",
              timestamp: getCurrentTimestamp(),
            }, null, 2),
          }],
          isError: true,
        };
      }

      // Step 2: If validate_only, just load and validate
      if (validate_only) {
        const loadResult = await this.loadAndValidateProtocol(protocolPath);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              mode: "validate_only",
              protocol: protocol,
              protocolPath,
              validation: loadResult,
              timestamp: getCurrentTimestamp(),
            }, null, 2),
          }],
        };
      }

      // Step 3: Execute via protocol-orchestrator
      const executionResult = await this.executeViaOrchestrator({
        protocolPath,
        variables,
        asyncMode,
        agentName: agent_name,
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            protocol: protocol,
            protocolPath,
            ...executionResult,
            timestamp: getCurrentTimestamp(),
          }, null, 2),
        }],
        isError: executionResult.status === 'error',
      };

    } catch (error) {
      return handleError(error, "execute_protocol");
    }
  }

  /**
   * Resolve a protocol name to its full file path
   * Handles various input formats:
   * - "mesh-communication" -> protocols/workflows/mesh-communication.yaml
   * - "workflows/mesh-communication" -> protocols/workflows/mesh-communication.yaml
   * - "jury-deliberation" -> protocols/meetings/jury-deliberation.yaml
   * - Full path -> use as-is
   */
  private async resolveProtocolPath(protocol: string): Promise<string | null> {
    // If it looks like a full path, use it directly
    if (protocol.endsWith('.yaml') || protocol.endsWith('.yml') || protocol.endsWith('.json')) {
      return protocol;
    }

    // Try to find the protocol using GetProtocolTool
    const getResult = await this.getProtocol.execute({ protocol });
    const resultText = getResult.content[0]?.text;

    if (resultText) {
      try {
        const parsed = JSON.parse(resultText);
        if (parsed.success && parsed.path) {
          // GetProtocolTool returns relative path from protocols dir
          // Protocol orchestrator expects path relative to its working directory
          return `./src/protocols/${parsed.path}`;
        }
      } catch {
        // Failed to parse, protocol not found
      }
    }

    // Try locations in order of priority:
    // 1. Root protocols directory (most common for main protocols)
    // 2. Workflows subdirectory
    // 3. Meetings subdirectory
    // 4. Templates subdirectory

    // Check root first - most protocols live here
    // This handles: jury-deliberate, memory-curation, meeting-protocol, etc.
    return `./src/protocols/${protocol}.yaml`;
  }

  /**
   * Load and validate a protocol via protocol-orchestrator's load_protocol tool
   */
  private async loadAndValidateProtocol(protocolPath: string): Promise<any> {
    try {
      const response = await fetch(PROTOCOL_ORCHESTRATOR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'load_protocol',
            arguments: { protocolPath }
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Protocol orchestrator returned ${response.status}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message || 'Protocol validation failed');
      }

      // Extract validation result from MCP response
      const content = result.result?.content?.[0]?.text;
      if (content) {
        return JSON.parse(content);
      }

      return { status: 'unknown' };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute protocol via protocol-orchestrator
   */
  private async executeViaOrchestrator(options: {
    protocolPath: string;
    variables: Record<string, any>;
    asyncMode: boolean;
    agentName: string;
  }): Promise<any> {
    const { protocolPath, variables, asyncMode, agentName } = options;

    try {
      const response = await fetch(PROTOCOL_ORCHESTRATOR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'execute_protocol',
            arguments: {
              protocolPath,
              variables,
              async: asyncMode,
              toolCallerType: 'bridge',
              agentName,
            }
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Protocol orchestrator returned ${response.status}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message || 'Protocol execution failed');
      }

      // Extract execution result from MCP response
      const content = result.result?.content?.[0]?.text;
      if (content) {
        return JSON.parse(content);
      }

      return { status: 'unknown' };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Check status of an async protocol execution job
 */
export class GetProtocolJobStatusTool {
  async execute(params: { job_id: string }): Promise<AiluminaToolResponse> {
    try {
      const { job_id } = params;

      if (!job_id) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: "job_id is required",
              timestamp: getCurrentTimestamp(),
            }, null, 2),
          }],
          isError: true,
        };
      }

      const response = await fetch(PROTOCOL_ORCHESTRATOR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'get_job_status',
            arguments: { jobId: job_id }
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Protocol orchestrator returned ${response.status}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message || 'Failed to get job status');
      }

      // Extract job status from MCP response
      const content = result.result?.content?.[0]?.text;
      if (content) {
        const jobStatus = JSON.parse(content);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              ...jobStatus,
              timestamp: getCurrentTimestamp(),
            }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: "Unexpected response format",
            timestamp: getCurrentTimestamp(),
          }, null, 2),
        }],
        isError: true,
      };

    } catch (error) {
      return handleError(error, "get_protocol_job_status");
    }
  }
}
