/**
 * Orchestrator Service Configuration
 *
 * Proxies to the Ailumina Bridge MCP server for agent orchestration.
 * Provides hierarchical service discovery through nested service cards.
 */

// Bridge HTTP server URL and optional auth
export const BRIDGE_URL = process.env.BRIDGE_URL || "http://localhost:3004";
export const BRIDGE_TOKEN = process.env.BRIDGE_AUTH_TOKEN || "";

// ============================================================================
// Types (from ailumina-bridge-mcp)
// ============================================================================

export interface AgentSummary {
  name: string;
  description: string;
  protocol?: string;
  function_count: number;
  agent_count: number;
  mcp_tool_count: number;
  total_tools: number;
  mcp_servers: string[];
}

export interface AgentDetails {
  name: string;
  description: string;
  system_prompt: string;
  protocol?: string;
  assigned_functions: string[];
  assigned_agents: string[];
  assigned_mcp_servers: string[];
  tools: string[];
  function_count: number;
  agent_count: number;
  mcp_tool_count: number;
  total_tools: number;
  mcp_servers: string[];
}

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  examples?: Array<{
    name?: string;
    description?: string;
    arguments: Record<string, unknown>;
  }>;
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
  };
}

export interface MCPServerHealth {
  name: string;
  url: string;
  healthy: boolean;
  lastHealthCheck: string;
  toolCount: number;
}

export interface ProtocolDefinition {
  name: string;
  description: string;
  steps: Array<{
    agent: string;
    instruction: string;
    output_key?: string;
  }>;
}

export interface ProtocolJobStatus {
  jobId: string;
  protocolName: string;
  status: "pending" | "running" | "completed" | "failed";
  currentStep?: number;
  totalSteps?: number;
  results?: Record<string, unknown>;
  error?: string;
}

// ============================================================================
// Parameter Types
// ============================================================================

export interface AgentsListParams {
  mcp_server?: string;
  limit?: number;
}

export interface AgentsGetParams {
  agent_name: string;
}

export interface AgentsSearchParams {
  query: string;
  limit?: number;
  fuzzy?: boolean;
}

export interface AgentsToolsListParams {
  agent_name: string;
}

export interface AgentsToolsCallParams {
  agent_name: string;
  tool_name: string;
  arguments: Record<string, unknown>;
}

export interface AiluminaChatParams {
  agent_type: "crud" | "news" | "collaborator" | "ailumina";
  user_input: string;
  chat_messages?: Array<{ role: string; content: string }>;
  fileId?: string;
  server_url?: string;
}

export interface ExecuteProtocolParams {
  protocol_name: string;
  input: Record<string, unknown>;
  async?: boolean;
}

export interface GetJobStatusParams {
  job_id: string;
}

export interface WorkflowsListParams {
  category?: string;
}

// ============================================================================
// Bridge Client
// ============================================================================

/**
 * Call the Bridge MCP server via JSON-RPC
 */
export async function callBridgeTool(
  toolName: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (BRIDGE_TOKEN) {
    headers["Authorization"] = `Bearer ${BRIDGE_TOKEN}`;
  }

  const response = await fetch(`${BRIDGE_URL}/`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: toolName,
        arguments: params,
      },
      id: Date.now(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Bridge server error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.error) {
    throw new Error(result.error.message || "Bridge tool error");
  }

  // Extract content from MCP response
  const content = result.result?.content;
  if (Array.isArray(content) && content.length > 0) {
    const textContent = content.find((c: { type: string }) => c.type === "text");
    if (textContent?.text) {
      try {
        return JSON.parse(textContent.text);
      } catch {
        return { text: textContent.text };
      }
    }
  }

  return result.result;
}
