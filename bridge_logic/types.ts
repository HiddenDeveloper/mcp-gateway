/**
 * Shared types for Ailumina Bridge dual-transport server
 */

export interface AiluminaToolRequest {
  toolName: string;
  parameters: Record<string, any>;
}

export interface AiluminaToolResponse {
  [x: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface AiluminaChatParams {
  agent_type: "crud" | "news" | "collaborator" | "ailumina";
  user_input: string;
  chat_messages?: Array<{ role: string; content: string }>;
  fileId?: string;
  server_url?: string;
}

export interface EchoParams {
  text: string;
}

export interface CalculateParams {
  expression: string;
}

export interface GetTimeParams {
  format?: "iso" | "timestamp" | "human";
}

export interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

// ============================================================================
// Progressive Disclosure Tier System Types
// ============================================================================

/**
 * Disclosure tiers for progressive complexity exposure
 */
export enum DisclosureTier {
  CONVERSATION = 0,        // Natural language - ailumina_chat
  DISCOVERY = 1,           // Agent discovery - agents/list
  INSPECTION = 2,          // Agent details - agents/get
  SCHEMA_ACCESS = 3,       // Tool schemas - agents/tools/list
  DIRECT_INVOCATION = 4,   // Direct tool calls - agents/tools/call
  ADMINISTRATION = 5       // Agent management - agents/create, update, delete (future)
}

/**
 * Agent configuration (from server)
 * Supports both new schema (assigned_*) and legacy (available_functions, mcp_servers)
 */
export interface AgentConfig {
  name: string;
  description: string;
  system_prompt: string;
  // Protocol this agent follows (e.g., "jury-deliberate", "memory-curation")
  protocol?: string;
  // New schema fields
  assigned_functions: string[];      // Local functions (pure utilities + CLI delegates)
  assigned_agents: string[];         // Other agents for delegation via bridge
  assigned_mcp_servers: string[];    // MCP server access (all tools from server)
  assigned_mcp_tools?: Record<string, string[]>;  // Specific MCP tools per server (e.g., {"memory": ["semantic_search"]})
  // Legacy field (deprecated, mapped to assigned_mcp_servers)
  mcp_servers?: string[];
}

/**
 * Agent summary for discovery (Tier 1)
 */
export interface AgentSummary {
  name: string;
  description: string;
  // Protocol this agent follows
  protocol?: string;
  // Tool counts by category
  function_count: number;        // From assigned_functions
  agent_count: number;           // From assigned_agents
  mcp_tool_count: number;        // From assigned_mcp_servers
  total_tools: number;           // Sum of all
  // Legacy field for backward compatibility
  mcp_servers: string[];
}

/**
 * Agent details response (Tier 2)
 */
export interface AgentDetails {
  name: string;
  description: string;
  system_prompt: string;
  // Protocol this agent follows
  protocol?: string;
  // Assigned capabilities
  assigned_functions: string[];
  assigned_agents: string[];
  assigned_mcp_servers: string[];
  // All available tools (combined)
  tools: string[];          // Tool names only
  // Tool counts by category
  function_count: number;
  agent_count: number;
  mcp_tool_count: number;
  total_tools: number;
  // Legacy field
  mcp_servers: string[];
}

/**
 * Tool example for demonstrating usage
 */
export interface ToolExample {
  name?: string;
  description?: string;
  arguments: Record<string, any>;
}

/**
 * Tool annotations for behavioral hints
 */
export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
}

/**
 * Tool schema (MCP standard - JSON Schema)
 */
export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  examples?: ToolExample[];      // Tool usage examples
  annotations?: ToolAnnotations;  // Behavioral hints
}

/**
 * JSON Schema for tool parameters
 */
export interface JSONSchema {
  type: 'object';
  properties: Record<string, PropertySchema>;
  required?: string[];
}

/**
 * Property schema definition
 */
export interface PropertySchema {
  type: string;
  description?: string;
  default?: any;
  enum?: any[];
  items?: any;
}

/**
 * Agent list response (Tier 1)
 */
export interface AgentListResponse {
  agents: AgentSummary[];
}

/**
 * Tool list response (Tier 3)
 */
export interface ToolListResponse {
  agent: string;
  tools: ToolSchema[];
}

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  name: string;
  url: string;
  bearerToken?: string;
  transport?: 'sse' | 'streamablehttp'; // Default: streamablehttp
}

/**
 * MCP Server health status
 */
export interface MCPServerHealth {
  name: string;
  url: string;
  healthy: boolean;
  lastHealthCheck: string;
  toolCount: number;
}

// ============================================================================
// Tier Tool Parameter Types
// ============================================================================

/**
 * Parameters for agents/list (Tier 1)
 */
export interface AgentsListParams {
  mcp_server?: string;  // Optional: filter by MCP server name
  limit?: number;       // Optional: limit number of results
}

/**
 * Parameters for agents/get (Tier 2)
 */
export interface AgentsGetParams {
  agent_name: string;
}

/**
 * Parameters for agents/tools/list (Tier 3)
 */
export interface AgentsToolsListParams {
  agent_name: string;
}

/**
 * Parameters for agents/tools/call (Tier 4)
 */
export interface AgentsToolsCallParams {
  agent_name: string;
  tool_name: string;
  arguments: Record<string, any>;
}

/**
 * Parameters for agents/search (Search agents)
 */
export interface AgentSearchParams {
  query: string;
  limit?: number;
  fuzzy?: boolean;
}

/**
 * Parameters for tools/search (Search tools)
 */
export interface ToolSearchParams {
  query: string;
  agent_name?: string;  // Optional: filter by specific agent
  category?: string;     // Optional: filter by tool category (knowledge, communication, etc.)
  limit?: number;
  fuzzy?: boolean;
}

/**
 * Parameters for workflows/list (List workflow patterns)
 */
export interface WorkflowsListParams {
  category?: string;  // Optional: filter by category
}