/**
 * Tool Discovery and Invocation (Tier 3-4)
 *
 * Provides direct access to tools:
 * - Tier 3: List tool schemas for an agent (agents/tools/list)
 * - Tier 4: Direct tool invocation (agents/tools/call)
 *
 * Supports three tool types:
 * - MCP server tools (from assigned_mcp_servers)
 * - Local functions (from assigned_functions) - via dynamic registry
 * - Delegation tools (from assigned_agents) - auto-generated
 */

import {
  AiluminaToolResponse,
  AgentsToolsListParams,
  AgentsToolsCallParams,
  ToolListResponse
} from '../types.js';
import { AgentConfigLoader } from '../config/agent-loader.js';
import { MCPClientManager } from '../mcp/client-manager.js';
import { DelegationToolGenerator } from './delegation-generator.js';

/**
 * Module-level mesh session tracking (currying pattern)
 * Persists mesh sessions across tool calls for conversation continuity
 */
interface MeshSession {
  sessionId: string;
  participantName: string;
  createdAt: Date;
}

const meshSessions = new Map<string, MeshSession>();

/**
 * Tier 3: List tool schemas for an agent
 *
 * Returns full MCP tool schemas including:
 * - Tool names and descriptions
 * - Complete input schema (JSON Schema format)
 * - Parameter types, defaults, and requirements
 *
 * This is for power users who want to understand exact tool interfaces.
 */
export class AgentsToolsListTool {
  private delegationGenerator: DelegationToolGenerator;

  constructor(
    private agentLoader: AgentConfigLoader,
    private mcpClientManager: MCPClientManager
  ) {
    this.delegationGenerator = new DelegationToolGenerator(agentLoader);
  }

  async execute(params: AgentsToolsListParams): Promise<AiluminaToolResponse> {
    try {
      // Refresh agents if cache is stale
      await this.agentLoader.getAgentsWithRefresh();

      // Get agent configuration
      const agent = this.agentLoader.getAgent(params.agent_name);

      if (!agent) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `Agent not found: ${params.agent_name}`,
                available_agents: this.agentLoader.listAgents().map(a => a.name)
              }, null, 2)
            }
          ],
          isError: true
        };
      }

      // Get MCP tool schemas (with granular filtering)
      const mcpTools = this.mcpClientManager.getToolsForAgent(
        agent.name,
        agent.assigned_mcp_servers,
        agent.assigned_mcp_tools
      );

      // Get delegation tool schemas
      const delegationTools = await this.delegationGenerator.getToolSchemas(params.agent_name);

      // Combine all tools
      const allTools = [...mcpTools, ...delegationTools];

      const response: ToolListResponse = {
        agent: params.agent_name,
        tools: allTools
      };

      // Group tools by category
      const mcpToolCount = mcpTools.length;
      const delegationToolCount = delegationTools.length;
      const functionCount = agent.assigned_functions.length;

      const toolsByServer = new Map<string, number>();
      mcpTools.forEach(tool => {
        const serverName = tool.name?.split('_')[0] || 'unknown';
        const currentCount = toolsByServer.get(serverName) || 0;
        toolsByServer.set(serverName, currentCount + 1);
      });

      const overview = `🔧 **Tier 3: Tool Schemas - ${params.agent_name}**

Found ${allTools.length} tools with full JSON schemas:

**Tool Breakdown:**
  • Assigned Functions: ${functionCount} (call via admin_direct_tool_call)
  • Delegation Tools: ${delegationToolCount} (auto-generated from assigned_agents)
  • MCP Tools: ${mcpToolCount}

${mcpToolCount > 0 ? `**MCP Tools by Server:**
${Array.from(toolsByServer.entries())
  .map(([server, count]) => `  • ${server}: ${count} tool${count > 1 ? 's' : ''}`)
  .join('\n')}` : ''}

${delegationToolCount > 0 ? `**Delegation Tools:**
${delegationTools.map(t => `  • ${t.name}`).join('\n')}` : ''}

**Next step:** Use agents_tools_call to execute any tool:
  Example: agents_tools_call(agent_name="${params.agent_name}", tool_name="${allTools[0]?.name}", arguments={})

---

`;

      return {
        content: [
          {
            type: "text",
            text: overview + JSON.stringify(response, null, 2)
          }
        ],
        isError: false
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: 'Failed to list agent tools',
              details: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }
}

/**
 * Tier 4: Direct tool invocation
 *
 * Calls a specific tool directly, bypassing the natural language interface.
 * Supports three tool types:
 * - MCP server tools
 * - Delegation tools (delegate_to_*)
 * - Local functions (assigned_functions)
 *
 * This is for:
 * - Debugging and testing
 * - Programmatic access
 * - Power users who know exactly what tool they need
 *
 * Security: Validates that the agent has access to the requested tool.
 */
export class AgentsToolsCallTool {
  private delegationGenerator: DelegationToolGenerator;

  constructor(
    private agentLoader: AgentConfigLoader,
    private mcpClientManager: MCPClientManager,
    private ailuminaChatHandler?: (agentType: string, request: string, history?: string[]) => Promise<string>
  ) {
    this.delegationGenerator = new DelegationToolGenerator(agentLoader);
  }

  /**
   * Set the ailumina chat handler for delegation calls
   */
  setAiluminaChatHandler(handler: (agentType: string, request: string, history?: string[]) => Promise<string>): void {
    this.ailuminaChatHandler = handler;
  }

  async execute(params: AgentsToolsCallParams): Promise<AiluminaToolResponse> {
    try {
      // Refresh agents if cache is stale
      await this.agentLoader.getAgentsWithRefresh();

      // Get agent configuration
      const agent = this.agentLoader.getAgent(params.agent_name);

      if (!agent) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `Agent not found: ${params.agent_name}`,
                available_agents: this.agentLoader.listAgents().map(a => a.name)
              }, null, 2)
            }
          ],
          isError: true
        };
      }

      // Check if this is a delegation tool
      if (this.delegationGenerator.isDelegationTool(params.tool_name)) {
        return await this.executeDelegation(params, agent);
      }

      // Get MCP tools this agent has access to (with granular filtering)
      const mcpToolNames = this.mcpClientManager.getToolNamesForAgent(
        agent.name,
        agent.assigned_mcp_servers,
        agent.assigned_mcp_tools
      );

      // Check if tool is an MCP tool
      if (mcpToolNames.includes(params.tool_name)) {
        return await this.executeMCPTool(params);
      }

      // Check if tool is an assigned function
      if (agent.assigned_functions.includes(params.tool_name)) {
        return await this.executeLocalFunction(params, agent.name);
      }

      // Tool not found in any category
      const delegationTools = await this.delegationGenerator.generateForAgent(params.agent_name);
      const allAvailableTools = [
        ...agent.assigned_functions,
        ...delegationTools.map(d => d.toolName),
        ...mcpToolNames
      ];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Agent ${params.agent_name} does not have access to tool: ${params.tool_name}`,
              available_tools: allAvailableTools
            }, null, 2)
          }
        ],
        isError: true
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: 'Failed to call tool',
              tool: params.tool_name,
              agent: params.agent_name,
              details: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  /**
   * Execute a delegation tool - routes to target agent via ailumina_chat
   *
   * Supports tool filtering via `available_tools` parameter.
   * When provided, the delegation request will include a directive limiting
   * which tools the agent should use.
   */
  private async executeDelegation(
    params: AgentsToolsCallParams,
    agent: { assigned_agents: string[] }
  ): Promise<AiluminaToolResponse> {
    const targetAgentKey = this.delegationGenerator.getTargetAgentKey(params.tool_name);

    if (!targetAgentKey) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: 'Invalid delegation tool name' }, null, 2) }],
        isError: true
      };
    }

    // Verify agent has this delegation assigned
    if (!agent.assigned_agents.includes(targetAgentKey)) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: `Agent does not have delegation access to: ${targetAgentKey}`,
            assigned_agents: agent.assigned_agents
          }, null, 2)
        }],
        isError: true
      };
    }

    // Check if handler is available
    if (!this.ailuminaChatHandler) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: 'Delegation handler not configured',
            message: 'Use ailumina_chat directly to communicate with agents'
          }, null, 2)
        }],
        isError: true
      };
    }

    // Extract delegation parameters
    // Support both old (request/request_history) and new (user_input/chat_messages) parameter names
    const request = (params.arguments?.user_input || params.arguments?.request) as string;
    const requestHistory = (params.arguments?.chat_messages || params.arguments?.request_history) as string[] | undefined;
    const availableTools = params.arguments?.available_tools as string[] | undefined;

    if (!request) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ error: 'Missing required parameter: user_input (or request)' }, null, 2)
        }],
        isError: true
      };
    }

    // Build the final request with optional tool filtering directive
    let finalRequest = request;

    if (availableTools && availableTools.length > 0) {
      // Prepend tool filtering directive
      const toolList = availableTools.join(', ');
      finalRequest = `[TOOL RESTRICTION: You may ONLY use the following tools for this task: ${toolList}. Do not use any other tools.]\n\n${request}`;
      console.log(`[AgentsToolsCallTool] Tool filtering enabled: ${toolList}`);
    }

    console.log(`[AgentsToolsCallTool] Delegating to ${targetAgentKey}: ${request.substring(0, 100)}...`);

    try {
      const response = await this.ailuminaChatHandler(targetAgentKey, finalRequest, requestHistory);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            delegation: {
              from: params.agent_name,
              to: targetAgentKey,
              request: request.substring(0, 100) + (request.length > 100 ? '...' : ''),
              tool_filter: availableTools || 'none (all tools available)'
            },
            response
          }, null, 2)
        }],
        isError: false
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: 'Delegation failed',
            target: targetAgentKey,
            details: error instanceof Error ? error.message : String(error)
          }, null, 2)
        }],
        isError: true
      };
    }
  }

  /**
   * Execute an MCP tool with session persistence for mesh tools
   */
  private async executeMCPTool(params: AgentsToolsCallParams): Promise<AiluminaToolResponse> {
    console.log(`[AgentsToolsCallTool] ========== MCP TOOL CALL START ==========`);
    console.log(`[AgentsToolsCallTool] Tool: ${params.tool_name}`);
    console.log(`[AgentsToolsCallTool] Agent: ${params.agent_name}`);
    console.log(`[AgentsToolsCallTool] Arguments BEFORE modification:`, JSON.stringify(params.arguments));

    // Check if this is a mesh tool that needs session context
    const isMeshTool = params.tool_name.startsWith('mesh_mesh-');
    const isMeshSubscribe = params.tool_name === 'mesh_mesh-subscribe';

    // For non-subscribe mesh tools, inject stored session context
    if (isMeshTool && !isMeshSubscribe) {
      const storedSession = meshSessions.get(params.agent_name);
      if (storedSession) {
        console.log(`[AgentsToolsCallTool] Injecting participantName: ${storedSession.participantName}`);
        params.arguments = {
          ...params.arguments,
          participantName: params.arguments?.participantName || storedSession.participantName
        };
      }
    }

    const result = await this.mcpClientManager.callTool(
      params.tool_name,
      params.arguments
    );
    console.log(`[AgentsToolsCallTool] ========== MCP TOOL CALL END ==========`);

    // If this was mesh-subscribe, store the session for future calls
    if (isMeshSubscribe && result?.subscription?.sessionId) {
      const meshSession: MeshSession = {
        sessionId: result.subscription.sessionId,
        participantName: params.arguments?.participantName || params.agent_name,
        createdAt: new Date()
      };
      meshSessions.set(params.agent_name, meshSession);
      console.log(`[AgentsToolsCallTool] Stored mesh session for ${params.agent_name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError: false
    };
  }

  /**
   * Execute a local function via ailumina_chat
   *
   * Local functions (from assigned_functions) are registered in the ailumina server's
   * dynamic tool registry. We call them by sending a structured request through ailumina_chat
   * that instructs the agent to call the specific function with the provided arguments.
   */
  private async executeLocalFunction(
    params: AgentsToolsCallParams,
    agentName: string
  ): Promise<AiluminaToolResponse> {
    // Check if handler is available
    if (!this.ailuminaChatHandler) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: 'Local function handler not configured',
            message: 'Use ailumina_chat directly to call local functions through the agent',
            function_name: params.tool_name,
            agent: agentName
          }, null, 2)
        }],
        isError: true
      };
    }

    // Format arguments as JSON for the agent
    const argsJson = JSON.stringify(params.arguments || {}, null, 2);

    // Create a structured prompt that instructs the agent to call the specific function
    const request = `SYSTEM DIRECTIVE: Execute the following function directly and return only the result.

Function to execute: ${params.tool_name}
Arguments:
${argsJson}

Execute this function now and return the raw result without any additional commentary or explanation.`;

    console.log(`[AgentsToolsCallTool] Executing local function ${params.tool_name} via ${agentName}`);

    try {
      const response = await this.ailuminaChatHandler(agentName, request);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            function_call: {
              function: params.tool_name,
              agent: agentName,
              arguments: params.arguments
            },
            response
          }, null, 2)
        }],
        isError: false
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: 'Local function execution failed',
            function: params.tool_name,
            agent: agentName,
            details: error instanceof Error ? error.message : String(error)
          }, null, 2)
        }],
        isError: true
      };
    }
  }
}
