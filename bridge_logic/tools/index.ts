/**
 * Ailumina Bridge tools registry
 */

// Core bridge tools
export { AiluminaStatusTool } from './ailumina-status.js';
export { AiluminaChatTool } from './ailumina-chat.js';

// Self-Evolution API tools
export { ListToolsTool } from './list-tools.js';
export { DeleteToolTool } from './delete-tool.js';
export { ReloadToolsTool } from './reload-tools.js';
export { ReloadAgentsTool, setAgentConfigLoader } from './reload-agents.js';
export { ListAgentsTool, GetAgentTool, CreateAgentTool, UpdateAgentTool, DeleteAgentTool } from './agent-crud.js';
export { RegisterMcpServerTool, UnregisterMcpServerTool, ListMcpServersTool, CallFunctionTool, setMCPClientManager } from './mcp-server-management.js';
export { ListProtocolsTool, GetProtocolTool, CreateProtocolTool, UpdateProtocolTool, DeleteProtocolTool } from './protocol-crud.js';
export { ExecuteProtocolTool, GetProtocolJobStatusTool } from './execute-protocol.js';

// Progressive Disclosure Tier tools
export { AgentsListTool, AgentsGetTool } from './agent-discovery.js';
export { AgentsToolsListTool, AgentsToolsCallTool } from './tool-discovery.js';
export { AgentSearchTool } from './agent-search.js';
export { ToolSearchTool } from './tool-search.js';
export { WorkflowsListTool } from './workflow-discovery.js';
export { TierToolsManager } from './tier-tools-manager.js';

// Custom experiment tools
export { RecordResearchInsightTool, GetResearchInsightsTool } from './research-insight.js';
export { CreateMeetingFromDslTool } from './create-meeting-from-dsl.js';

import { AiluminaStatusTool } from './ailumina-status.js';
import { AiluminaChatTool } from './ailumina-chat.js';
import { ListToolsTool } from './list-tools.js';
import { DeleteToolTool } from './delete-tool.js';
import { ReloadToolsTool } from './reload-tools.js';
import { ReloadAgentsTool } from './reload-agents.js';
import { ListAgentsTool, GetAgentTool, CreateAgentTool, UpdateAgentTool, DeleteAgentTool } from './agent-crud.js';
import { RegisterMcpServerTool, UnregisterMcpServerTool, ListMcpServersTool, CallFunctionTool } from './mcp-server-management.js';
import { ListProtocolsTool, GetProtocolTool, CreateProtocolTool, UpdateProtocolTool, DeleteProtocolTool } from './protocol-crud.js';
import { ExecuteProtocolTool, GetProtocolJobStatusTool } from './execute-protocol.js';
import { RecordResearchInsightTool, GetResearchInsightsTool } from './research-insight.js';
import { CreateMeetingFromDslTool } from './create-meeting-from-dsl.js';

/**
 * Registry of all available Ailumina Bridge tools
 *
 * Naming convention:
 * - Core tools: Simple names (ailumina_status, ailumina_chat)
 * - Admin tools: admin_* prefix (bridge management, agent CRUD, MCP server management)
 * - Tier tools: agents_*, tools_*, workflows_* (managed by TierToolsManager, not here)
 */
export const AILUMINA_TOOLS = {
  // Core bridge tools
  ailumina_status: new AiluminaStatusTool(),
  ailumina_chat: new AiluminaChatTool(),

  // Admin: Dynamic function registry management
  admin_list_functions: new ListToolsTool(),
  admin_delete_function: new DeleteToolTool(),
  admin_reload_functions: new ReloadToolsTool(),

  // Admin: Agent configuration management
  admin_reload_agents: new ReloadAgentsTool(),
  admin_list_agent_configs: new ListAgentsTool(),
  admin_get_agent_config: new GetAgentTool(),
  admin_create_agent: new CreateAgentTool(),
  admin_update_agent: new UpdateAgentTool(),
  admin_delete_agent: new DeleteAgentTool(),

  // Admin: MCP server management
  admin_register_mcp_server: new RegisterMcpServerTool(),
  admin_unregister_mcp_server: new UnregisterMcpServerTool(),
  admin_list_mcp_servers: new ListMcpServersTool(),

  // Admin: Protocol library management
  admin_list_protocols: new ListProtocolsTool(),
  admin_get_protocol: new GetProtocolTool(),
  admin_create_protocol: new CreateProtocolTool(),
  admin_update_protocol: new UpdateProtocolTool(),
  admin_delete_protocol: new DeleteProtocolTool(),

  // Protocol execution (unified entry point)
  execute_protocol: new ExecuteProtocolTool(),
  get_protocol_job_status: new GetProtocolJobStatusTool(),

  // Admin: Direct function/tool execution (no agent required)
  admin_call_function: new CallFunctionTool(),

  // Custom experiment tools
  record_research_insight: new RecordResearchInsightTool(),
  get_research_insights: new GetResearchInsightsTool(),
  create_meeting_from_dsl: new CreateMeetingFromDslTool(),
} as const;

export type AiluminaToolName = keyof typeof AILUMINA_TOOLS;