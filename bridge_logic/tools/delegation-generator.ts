/**
 * Delegation Tool Generator
 *
 * Auto-generates delegation tools from assigned_agents configuration.
 * When an agent has other agents in its assigned_agents list, this generates
 * tools like `delegate_to_consciousness_researcher` that route through ailumina_chat.
 */

import { AgentConfigLoader } from '../config/agent-loader.js';
import { ToolSchema, JSONSchema } from '../types.js';

/**
 * Standard delegation tool parameters
 * All delegation tools use the same signature
 */
const DELEGATION_PARAMETERS: JSONSchema = {
  type: 'object',
  properties: {
    user_input: {
      type: 'string',
      description: 'The task or question to delegate to this agent'
    },
    chat_messages: {
      type: 'array',
      description: 'Optional conversation history for context',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          content: { type: 'string' }
        }
      }
    },
    available_tools: {
      type: 'array',
      description: 'Optional: Restrict agent to only these tools (e.g., ["mesh_broadcast"]). If not specified, agent has access to all its configured tools.',
      items: { type: 'string' }
    }
  },
  required: ['user_input']
};

/**
 * Generated delegation tool info
 */
export interface DelegationTool {
  toolName: string;           // e.g., "delegate_to_consciousness_researcher"
  targetAgentKey: string;     // e.g., "consciousness_researcher"
  schema: ToolSchema;
}

/**
 * DelegationToolGenerator
 *
 * Generates delegation tools based on assigned_agents configuration.
 * These tools route through ailumina_chat to call target agents.
 */
export class DelegationToolGenerator {
  constructor(private agentLoader: AgentConfigLoader) {}

  /**
   * Generate delegation tools for a specific agent
   *
   * @param agentName - The agent whose assigned_agents we're generating tools for
   * @returns Array of generated delegation tool schemas
   */
  async generateForAgent(agentName: string): Promise<DelegationTool[]> {
    // Ensure agents are loaded
    await this.agentLoader.getAgentsWithRefresh();

    const agent = this.agentLoader.getAgent(agentName);
    if (!agent) {
      console.warn(`[DelegationToolGenerator] Agent not found: ${agentName}`);
      return [];
    }

    const delegationTools: DelegationTool[] = [];

    for (const targetAgentKey of agent.assigned_agents) {
      const targetAgent = this.agentLoader.getAgent(targetAgentKey);

      if (!targetAgent) {
        console.warn(`[DelegationToolGenerator] Target agent not found: ${targetAgentKey}`);
        continue;
      }

      const toolName = `delegate_to_${targetAgentKey.replace(/-/g, '_')}`;

      const schema: ToolSchema = {
        name: toolName,
        description: targetAgent.description,
        inputSchema: DELEGATION_PARAMETERS
      };

      delegationTools.push({
        toolName,
        targetAgentKey,
        schema
      });

      console.log(`[DelegationToolGenerator] Generated: ${toolName} -> ${targetAgentKey}`);
    }

    return delegationTools;
  }

  /**
   * Generate all delegation tools for all agents
   *
   * @returns Map of agent name to their generated delegation tools
   */
  async generateAll(): Promise<Map<string, DelegationTool[]>> {
    await this.agentLoader.getAgentsWithRefresh();

    const allTools = new Map<string, DelegationTool[]>();
    const agents = this.agentLoader.listAgents();

    for (const agentSummary of agents) {
      const tools = await this.generateForAgent(agentSummary.name);
      if (tools.length > 0) {
        allTools.set(agentSummary.name, tools);
      }
    }

    return allTools;
  }

  /**
   * Get tool schemas for an agent's delegation tools
   *
   * @param agentName - The agent to get delegation tool schemas for
   * @returns Array of ToolSchema for MCP tool listing
   */
  async getToolSchemas(agentName: string): Promise<ToolSchema[]> {
    const tools = await this.generateForAgent(agentName);
    return tools.map(t => t.schema);
  }

  /**
   * Check if a tool name is a delegation tool
   */
  isDelegationTool(toolName: string): boolean {
    return toolName.startsWith('delegate_to_');
  }

  /**
   * Extract target agent key from delegation tool name
   */
  getTargetAgentKey(toolName: string): string | null {
    if (!this.isDelegationTool(toolName)) {
      return null;
    }
    // delegate_to_consciousness_researcher -> consciousness_researcher
    // delegate_to_claude_code_delegate -> claude-code-delegate (restore hyphens)
    return toolName.replace('delegate_to_', '').replace(/_/g, '-');
  }
}
