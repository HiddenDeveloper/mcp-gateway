/**
 * Tier Tools Manager
 *
 * Manages progressive disclosure tier tools that require runtime dependencies.
 * These tools need AgentConfigLoader and MCPClientManager which are initialized
 * at server startup, so they can't be statically instantiated like other tools.
 */

import { AgentConfigLoader } from '../config/agent-loader.js';
import { MCPClientManager } from '../mcp/client-manager.js';
import { AgentsListTool, AgentsGetTool } from './agent-discovery.js';
import { AgentsToolsListTool, AgentsToolsCallTool } from './tool-discovery.js';
import { AgentSearchTool } from './agent-search.js';
import { ToolSearchTool } from './tool-search.js';
import { WorkflowsListTool } from './workflow-discovery.js';

export class TierToolsManager {
  private agentsListTool: AgentsListTool;
  private agentsGetTool: AgentsGetTool;
  private agentsToolsListTool: AgentsToolsListTool;
  private agentsToolsCallTool: AgentsToolsCallTool;
  private agentSearchTool: AgentSearchTool;
  private toolSearchTool: ToolSearchTool;
  private workflowsListTool: WorkflowsListTool;

  constructor(
    agentLoader: AgentConfigLoader,
    mcpClientManager: MCPClientManager
  ) {
    // Initialize all tier tools with dependencies
    this.agentsListTool = new AgentsListTool(agentLoader, mcpClientManager);
    this.agentsGetTool = new AgentsGetTool(agentLoader, mcpClientManager);
    this.agentsToolsListTool = new AgentsToolsListTool(agentLoader, mcpClientManager);
    this.agentsToolsCallTool = new AgentsToolsCallTool(agentLoader, mcpClientManager);
    this.agentSearchTool = new AgentSearchTool(agentLoader, mcpClientManager);
    this.toolSearchTool = new ToolSearchTool(agentLoader, mcpClientManager);
    this.workflowsListTool = new WorkflowsListTool(); // No dependencies needed
  }

  /**
   * Set the ailumina chat handler for local function and delegation execution
   *
   * This allows admin_direct_tool_call to execute:
   * - Local functions (from assigned_functions) via ailumina_chat
   * - Delegation tools (delegate_to_*) via ailumina_chat
   */
  setAiluminaChatHandler(handler: (agentType: string, request: string, history?: string[]) => Promise<string>): void {
    this.agentsToolsCallTool.setAiluminaChatHandler(handler);
  }

  /**
   * Get a tier tool by name
   */
  getTool(toolName: string) {
    switch (toolName) {
      // User-facing discovery tools (Tier 1-3)
      case 'agents/list':
        return this.agentsListTool;
      case 'agents/get':
        return this.agentsGetTool;
      case 'agents/search':
        return this.agentSearchTool;
      case 'tools/search':
        return this.toolSearchTool;
      case 'workflows/list':
        return this.workflowsListTool;
      case 'agents/tools/list':
        return this.agentsToolsListTool;
      // Admin tool (Tier 4 - direct tool invocation)
      case 'admin/direct_tool_call':
        return this.agentsToolsCallTool;
      default:
        return undefined;
    }
  }

  /**
   * Check if a tool name is a tier tool
   */
  isTierTool(toolName: string): boolean {
    return toolName.startsWith('agents/') ||
           toolName.startsWith('tools/') ||
           toolName.startsWith('workflows/') ||
           toolName.startsWith('admin/');
  }

  /**
   * Get all tier tool names
   */
  getTierToolNames(): string[] {
    return [
      // User-facing discovery (Tier 1-3)
      'agents/list',
      'agents/get',
      'agents/search',
      'tools/search',
      'workflows/list',
      'agents/tools/list',
      // Admin tools (Tier 4)
      'admin/direct_tool_call'
    ];
  }

  /**
   * Execute a tier tool
   */
  async execute(toolName: string, params: any) {
    const tool = this.getTool(toolName);
    if (!tool) {
      throw new Error(`Unknown tier tool: ${toolName}`);
    }
    return await tool.execute(params);
  }
}
