/**
 * Orchestrator Type Definitions
 *
 * Types for agent configuration, discovery, and tool management.
 * Adapted from ailumina-bridge-mcp for standalone implementation.
 */

// ============================================================================
// Agent Configuration (from agents.json)
// ============================================================================

export interface AgentConfig {
  agent_name?: string;
  name?: string;
  description: string;
  system_prompt: string;
  service_provider?: string;
  model_name?: string;
  do_stream?: boolean;
  protocol?: string;
  assigned_functions?: string[];
  assigned_agents?: string[];
  assigned_mcp_servers?: string[];
  assigned_mcp_tools?: Record<string, string[]>;
  custom_settings?: Record<string, unknown>;
  // Legacy fields for backward compatibility
  available_functions?: string[];
  mcp_servers?: string[];
}

export interface AgentsConfig {
  [key: string]: AgentConfig;
}

// ============================================================================
// Agent Discovery Types (API responses)
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

export interface AgentDetails extends AgentSummary {
  system_prompt: string;
  assigned_functions: string[];
  assigned_agents: string[];
  assigned_mcp_servers: string[];
  tools: string[];
}

export interface AgentSearchResult extends AgentSummary {
  score: number;
  match_reasons: string[];
}

// ============================================================================
// Tool Types
// ============================================================================

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

export interface ServiceToolConfig {
  name: string;
  endpoint: string;
  method: "GET" | "POST";
  description: string;
  inputSchema?: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ServiceConfig {
  baseUrl: string;
  tools: ServiceToolConfig[];
}

// ============================================================================
// Protocol Types
// ============================================================================

export interface ProtocolDefinition {
  name: string;
  description: string;
  version?: string;
  category?: string;
  tags?: string[];
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

export interface ProtocolsListParams {
  category?: string;
}

export interface ProtocolsExecuteParams {
  protocol_name: string;
  variables?: Record<string, unknown>;
  async?: boolean;
}

export interface ProtocolsStatusParams {
  job_id: string;
}
