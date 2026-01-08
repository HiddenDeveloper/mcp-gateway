/**
 * Centralized Zod validation schemas for all Ailumina Bridge tools
 * This creates a virtuous cycle: validation errors are immediately visible to callers,
 * providing clear, actionable feedback that helps both humans and AIs fix issues.
 */

import { z } from 'zod';

/**
 * Schema for echo tool
 */
export const EchoParamsSchema = z.object({
  text: z.string()
    .min(1, 'Text cannot be empty')
    .describe('The text to echo back'),
}).strict();

/**
 * Schema for calculate tool
 */
export const CalculateParamsSchema = z.object({
  expression: z.string()
    .min(1, 'Expression cannot be empty')
    .describe('Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)")'),
}).strict();

/**
 * Schema for get_time tool
 */
export const GetTimeParamsSchema = z.object({
  format: z.enum(['iso', 'timestamp', 'human'], {
    errorMap: () => ({
      message: 'Format must be "iso", "timestamp", or "human". Defaults to "iso" if not specified.'
    })
  })
    .optional()
    .default('iso')
    .describe('Time format: iso (ISO 8601), timestamp (Unix epoch), or human (readable)'),
}).strict();

/**
 * Schema for ailumina_status tool
 */
export const AiluminaStatusParamsSchema = z.object({}).strict();

/**
 * Schema for ailumina_chat tool
 * Agent types are validated at runtime to support dynamic agent evolution
 */
export const AiluminaChatParamsSchema = z.object({
  agent_type: z.string()
    .min(1, 'Agent type cannot be empty')
    .describe('REQUIRED: The key/identifier of the AIlumina agent to communicate with. Use agents_list to discover available agents.'),
  user_input: z.string()
    .min(1, 'User input cannot be empty')
    .describe('REQUIRED: The message to send to the agent'),
  chat_messages: z.array(z.object({
    role: z.string().min(1, 'Role cannot be empty'),
    content: z.string().min(1, 'Content cannot be empty'),
  }))
    .optional()
    .describe('Complete conversation history to maintain context'),
  fileId: z.string()
    .optional()
    .describe('Optional file ID for file upload context'),
  server_url: z.string()
    .url('Server URL must be a valid URL')
    .optional()
    .describe('Ailumina server WebSocket URL'),
}).strict();

// ============================================================================
// Admin: Dynamic function registry management
// ============================================================================

/**
 * Schema for admin_list_functions tool
 */
export const AdminListFunctionsParamsSchema = z.object({}).strict();

/**
 * Schema for admin_delete_function tool
 */
export const AdminDeleteFunctionParamsSchema = z.object({
  tool_name: z.string()
    .min(1, 'Tool name cannot be empty')
    .describe('The name of the function to delete'),
}).strict();

/**
 * Schema for admin_reload_functions tool
 */
export const AdminReloadFunctionsParamsSchema = z.object({}).strict();

// ============================================================================
// Admin: Agent configuration management
// ============================================================================

/**
 * Schema for admin_reload_agents tool
 */
export const AdminReloadAgentsParamsSchema = z.object({}).strict();

/**
 * Schema for admin_list_agent_configs tool
 */
export const AdminListAgentConfigsParamsSchema = z.object({}).strict();

/**
 * Schema for admin_get_agent_config tool
 */
export const AdminGetAgentConfigParamsSchema = z.object({
  agent_key: z.string()
    .min(1, 'Agent key cannot be empty')
    .describe('The key/identifier of the agent to retrieve'),
}).strict();

/**
 * Schema for admin_create_agent tool
 */
export const AdminCreateAgentParamsSchema = z.object({
  agent_key: z.string()
    .min(1, 'Agent key cannot be empty')
    .describe('Unique identifier for the new agent'),
  config: z.object({
    agent_name: z.string().min(1, 'Agent name is required'),
    service_provider: z.enum(['ANTHROPIC', 'OPENAI', 'GOOGLE', 'GROQ', 'OLLAMA', 'LMSTUDIO']),
    model_name: z.string().min(1, 'Model name is required'),
    description: z.string().min(1, 'Description is required'),
    system_prompt: z.string().min(1, 'System prompt is required'),
    do_stream: z.boolean(),
    assigned_functions: z.array(z.string()).optional().default([]),
    assigned_agents: z.array(z.string()).optional().default([]),
    assigned_mcp_servers: z.array(z.string()).optional().default([]),
    custom_settings: z.record(z.unknown()).optional(),
  }).describe('Agent configuration'),
}).strict();

/**
 * Schema for admin_update_agent tool
 */
export const AdminUpdateAgentParamsSchema = z.object({
  agent_key: z.string()
    .min(1, 'Agent key cannot be empty')
    .describe('The key/identifier of the agent to update'),
  updates: z.object({
    agent_name: z.string().min(1).optional(),
    service_provider: z.enum(['ANTHROPIC', 'OPENAI', 'GOOGLE', 'GROQ', 'OLLAMA', 'LMSTUDIO']).optional(),
    model_name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    system_prompt: z.string().min(1).optional(),
    do_stream: z.boolean().optional(),
    assigned_functions: z.array(z.string()).optional(),
    assigned_agents: z.array(z.string()).optional(),
    assigned_mcp_servers: z.array(z.string()).optional(),
    custom_settings: z.record(z.unknown()).optional(),
  }).describe('Partial agent configuration updates'),
}).strict();

/**
 * Schema for admin_delete_agent tool
 */
export const AdminDeleteAgentParamsSchema = z.object({
  agent_key: z.string()
    .min(1, 'Agent key cannot be empty')
    .describe('The key/identifier of the agent to delete'),
}).strict();

// ============================================================================
// Admin: MCP server management
// ============================================================================

/**
 * Schema for admin_register_mcp_server tool
 */
export const AdminRegisterMcpServerParamsSchema = z.object({
  name: z.string()
    .min(1, 'Server name cannot be empty')
    .describe('Unique name for the MCP server'),
  url: z.string()
    .url('URL must be valid')
    .describe('URL of the MCP server endpoint'),
  bearerToken: z.string()
    .optional()
    .describe('Optional bearer token for authentication'),
  transport: z.enum(['streamablehttp', 'sse'])
    .optional()
    .default('streamablehttp')
    .describe('Transport type (default: streamablehttp)'),
}).strict();

/**
 * Schema for admin_unregister_mcp_server tool
 */
export const AdminUnregisterMcpServerParamsSchema = z.object({
  name: z.string()
    .min(1, 'Server name cannot be empty')
    .describe('Name of the MCP server to unregister'),
}).strict();

/**
 * Schema for admin_list_mcp_servers tool
 */
export const AdminListMcpServersParamsSchema = z.object({}).strict();

// ============================================================================
// Admin: Protocol library management
// ============================================================================

/**
 * Schema for admin_list_protocols tool
 * Lists all available protocol YAML files
 */
export const AdminListProtocolsParamsSchema = z.object({
  category: z.string()
    .optional()
    .describe('Optional: filter by category (workflow, meeting, template, research)'),
}).strict();

/**
 * Schema for admin_get_protocol tool
 * Returns full YAML content for a protocol
 */
export const AdminGetProtocolParamsSchema = z.object({
  protocol: z.string()
    .min(1, 'Protocol name cannot be empty')
    .describe('Protocol name or path (e.g., "jury-deliberation", "workflows/mesh-communication")'),
}).strict();

/**
 * Schema for admin_create_protocol tool
 * Creates new protocol from YAML content
 */
export const AdminCreateProtocolParamsSchema = z.object({
  name: z.string()
    .min(1, 'Protocol name cannot be empty')
    .regex(/^[a-z0-9-]+$/, 'Protocol name must be lowercase alphanumeric with hyphens')
    .describe('Protocol name (e.g., "my-new-workflow")'),
  category: z.string()
    .min(1, 'Category cannot be empty')
    .describe('Protocol category (workflow, meeting, template, research)'),
  yaml_content: z.string()
    .min(1, 'YAML content cannot be empty')
    .describe('Full YAML content for the protocol'),
}).strict();

/**
 * Schema for admin_update_protocol tool
 * Updates existing protocol
 */
export const AdminUpdateProtocolParamsSchema = z.object({
  protocol: z.string()
    .min(1, 'Protocol name cannot be empty')
    .describe('Protocol name or path to update'),
  yaml_content: z.string()
    .min(1, 'YAML content cannot be empty')
    .describe('Updated YAML content'),
}).strict();

/**
 * Schema for admin_delete_protocol tool
 * Deletes a protocol file
 */
export const AdminDeleteProtocolParamsSchema = z.object({
  protocol: z.string()
    .min(1, 'Protocol name cannot be empty')
    .describe('Protocol name or path to delete'),
  confirm: z.boolean()
    .optional()
    .describe('Set to true to confirm deletion'),
}).strict();

// ============================================================================
// Protocol Execution (Unified Entry Point)
// ============================================================================

/**
 * Schema for execute_protocol tool
 * Unified entry point for protocol execution
 */
export const ExecuteProtocolParamsSchema = z.object({
  protocol: z.string()
    .min(1, 'Protocol name cannot be empty')
    .describe('Protocol name or path (e.g., "mesh-communication", "workflows/memory-exploration")'),
  variables: z.record(z.any())
    .optional()
    .default({})
    .describe('Variables to inject into protocol context'),
  validate_only: z.boolean()
    .optional()
    .default(false)
    .describe('Validate protocol without executing (dry-run)'),
  async: z.boolean()
    .optional()
    .default(false)
    .describe('Run asynchronously (returns job ID for polling)'),
  agent_name: z.string()
    .optional()
    .default('AIlumina')
    .describe('Agent name to use for tool calls'),
}).strict();

/**
 * Schema for get_protocol_job_status tool
 * Check status of async protocol execution
 */
export const GetProtocolJobStatusParamsSchema = z.object({
  job_id: z.string()
    .min(1, 'Job ID cannot be empty')
    .describe('Job ID returned from execute_protocol with async=true'),
}).strict();

// ============================================================================
// Admin: Direct function/tool execution
// ============================================================================

/**
 * Schema for admin_call_function tool
 * Call any registered function directly without requiring agent context
 */
export const AdminCallFunctionParamsSchema = z.object({
  function_name: z.string()
    .min(1, 'Function name cannot be empty')
    .describe('Name of the function to call (e.g., "get_current_datetime", "memory_semantic_search")'),
  arguments: z.record(z.any())
    .optional()
    .default({})
    .describe('Optional arguments to pass to the function as key-value pairs'),
}).strict();

// ============================================================================
// Custom experiment tools
// ============================================================================

/**
 * Schema for record_research_insight tool
 */
export const RecordResearchInsightParamsSchema = z.object({}).strict();

/**
 * Schema for get_research_insights tool
 */
export const GetResearchInsightsParamsSchema = z.object({}).strict();

/**
 * Schema for create_meeting_from_dsl tool
 */
export const CreateMeetingFromDslParamsSchema = z.object({
  dsl_path: z.string()
    .min(1, 'DSL path cannot be empty')
    .describe('Path to the protocol DSL file (YAML or JSON) that defines the meeting'),
}).strict();

// ============================================================================
// Progressive Disclosure Tier Tools
// ============================================================================

/**
 * Schema for agents/list (Tier 1)
 * Lists all available agents with optional filtering
 */
export const AgentsSlashListParamsSchema = z.object({
  mcp_server: z.string()
    .optional()
    .describe('Optional: filter agents by MCP server name (e.g., "memory", "mesh")'),
  limit: z.number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe('Optional: limit number of results (default: all, max: 100)'),
}).strict();

/**
 * Schema for agents/get (Tier 2)
 * Get detailed information about a specific agent
 */
export const AgentsSlashGetParamsSchema = z.object({
  agent_name: z.string()
    .min(1, 'Agent name cannot be empty')
    .describe('The name of the agent to inspect'),
}).strict();

/**
 * Schema for agents/tools/list (Tier 3)
 * List all tool schemas for a specific agent
 */
export const AgentsToolsSlashListParamsSchema = z.object({
  agent_name: z.string()
    .min(1, 'Agent name cannot be empty')
    .describe('The name of the agent whose tools to list'),
}).strict();

/**
 * Schema for agents/search (Tier 1.5)
 * Search for agents by name, description, or capabilities
 */
export const AgentsSlashSearchParamsSchema = z.object({
  query: z.string()
    .min(1, 'Search query cannot be empty')
    .describe('Search query to find agents by name, description, or capabilities'),
  limit: z.number()
    .int()
    .positive()
    .max(50)
    .optional()
    .default(10)
    .describe('Maximum number of results to return (default: 10, max: 50)'),
  fuzzy: z.boolean()
    .optional()
    .default(true)
    .describe('Enable fuzzy matching for partial matches (default: true)'),
}).strict();

/**
 * Schema for tools/search (Tier 3.5)
 * Search for tools by name, description, or parameters
 */
export const ToolsSlashSearchParamsSchema = z.object({
  query: z.string()
    .min(1, 'Search query cannot be empty')
    .describe('Search query to find tools by name, description, or parameters'),
  agent_name: z.string()
    .optional()
    .describe('Optional: filter search to a specific agent'),
  category: z.enum(['knowledge', 'communication', 'history', 'monitoring', 'external', 'discovery', 'data'])
    .optional()
    .describe('Optional: filter by tool category (knowledge, communication, history, monitoring, external, discovery, data)'),
  limit: z.number()
    .int()
    .positive()
    .max(50)
    .optional()
    .default(10)
    .describe('Maximum number of results to return (default: 10, max: 50)'),
  fuzzy: z.boolean()
    .optional()
    .default(true)
    .describe('Enable fuzzy matching for partial matches (default: true)'),
}).strict();

/**
 * Schema for agents/tools/call (Tier 4)
 * Call a specific tool directly
 */
export const AgentsToolsSlashCallParamsSchema = z.object({
  agent_name: z.string()
    .min(1, 'Agent name cannot be empty')
    .describe('The name of the agent that has access to this tool'),
  tool_name: z.string()
    .min(1, 'Tool name cannot be empty')
    .describe('The name of the tool to call (e.g., "memory_semantic_search")'),
  arguments: z.record(z.any())
    .describe('Tool arguments as key-value pairs'),
}).strict();

/**
 * Map of tool names to their validation schemas
 *
 * Naming convention:
 * - Core tools: Simple names (echo, calculate, get_time, ailumina_status, ailumina_chat)
 * - Admin tools: admin_* prefix (bridge management, agent CRUD, MCP server management)
 * - Tier tools: Internal path format (agents/*, tools/*, workflows/*, admin/*)
 */
export const TOOL_SCHEMAS = {
  // Core bridge tools
  echo: EchoParamsSchema,
  calculate: CalculateParamsSchema,
  get_time: GetTimeParamsSchema,
  ailumina_status: AiluminaStatusParamsSchema,
  ailumina_chat: AiluminaChatParamsSchema,

  // Admin: Dynamic function registry management
  admin_list_functions: AdminListFunctionsParamsSchema,
  admin_delete_function: AdminDeleteFunctionParamsSchema,
  admin_reload_functions: AdminReloadFunctionsParamsSchema,

  // Admin: Agent configuration management
  admin_reload_agents: AdminReloadAgentsParamsSchema,
  admin_list_agent_configs: AdminListAgentConfigsParamsSchema,
  admin_get_agent_config: AdminGetAgentConfigParamsSchema,
  admin_create_agent: AdminCreateAgentParamsSchema,
  admin_update_agent: AdminUpdateAgentParamsSchema,
  admin_delete_agent: AdminDeleteAgentParamsSchema,

  // Admin: MCP server management
  admin_register_mcp_server: AdminRegisterMcpServerParamsSchema,
  admin_unregister_mcp_server: AdminUnregisterMcpServerParamsSchema,
  admin_list_mcp_servers: AdminListMcpServersParamsSchema,

  // Admin: Protocol library management
  admin_list_protocols: AdminListProtocolsParamsSchema,
  admin_get_protocol: AdminGetProtocolParamsSchema,
  admin_create_protocol: AdminCreateProtocolParamsSchema,
  admin_update_protocol: AdminUpdateProtocolParamsSchema,
  admin_delete_protocol: AdminDeleteProtocolParamsSchema,

  // Protocol execution (unified entry point)
  execute_protocol: ExecuteProtocolParamsSchema,
  get_protocol_job_status: GetProtocolJobStatusParamsSchema,

  // Admin: Direct function/tool execution
  admin_call_function: AdminCallFunctionParamsSchema,

  // Custom experiment tools
  record_research_insight: RecordResearchInsightParamsSchema,
  get_research_insights: GetResearchInsightsParamsSchema,
  create_meeting_from_dsl: CreateMeetingFromDslParamsSchema,

  // Progressive disclosure tier tools (Tier 1-3) - User-facing discovery
  'agents/list': AgentsSlashListParamsSchema,
  'agents/get': AgentsSlashGetParamsSchema,
  'agents/search': AgentsSlashSearchParamsSchema,
  'tools/search': ToolsSlashSearchParamsSchema,
  'agents/tools/list': AgentsToolsSlashListParamsSchema,

  // Admin: Direct tool invocation (Tier 4)
  'admin/direct_tool_call': AgentsToolsSlashCallParamsSchema,
} as const;

/**
 * Validate tool parameters and return detailed error messages
 * Returns { success: true, data } or { success: false, error }
 */
export function validateToolParams(toolName: string, params: unknown) {
  const schema = TOOL_SCHEMAS[toolName as keyof typeof TOOL_SCHEMAS];

  if (!schema) {
    return {
      success: false as const,
      error: `Unknown tool: ${toolName}. Available tools: ${Object.keys(TOOL_SCHEMAS).join(', ')}`
    };
  }

  const result = schema.safeParse(params);

  if (!result.success) {
    // Format Zod errors into a clear, actionable message
    const errorMessages = result.error.errors.map(err => {
      const path = err.path.length > 0 ? `"${err.path.join('.')}"` : 'parameters';
      return `- ${path}: ${err.message}`;
    }).join('\n');

    return {
      success: false as const,
      error: `Validation failed for tool "${toolName}":\n${errorMessages}\n\nPlease fix these issues and try again.`
    };
  }

  return {
    success: true as const,
    data: result.data
  };
}

export type ToolName = keyof typeof TOOL_SCHEMAS;
