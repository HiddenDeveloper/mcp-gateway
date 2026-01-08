/**
 * Chat Route
 *
 * Route natural language to the appropriate agent.
 * This is Tier 0 - the highest level abstraction for conversational AI.
 *
 * Standalone implementation - provides agent routing info.
 * Full LLM-based chat requires an LLM client integration.
 */

import { getAgent, buildAgentDetails, getAgentToolNames } from "./lib/agent-loader";
import { getServiceRegistry } from "./lib/service-registry";
import { executeAiluminaChat } from "./lib/websocket-client";

interface ChatRouteParams {
  agent_type: string;
  user_input: string;
  chat_messages?: Array<{ role: string; content: string }>;
  execute?: boolean;
}

export default async function (params: Record<string, unknown>) {
  const { agent_type, user_input, chat_messages, execute } = params as ChatRouteParams;

  if (!agent_type) {
    throw new Error("Missing required parameter: agent_type");
  }
  if (!user_input) {
    throw new Error("Missing required parameter: user_input");
  }

  try {
    // Get agent configuration
    const agent = await getAgent(agent_type);

    if (!agent) {
      return {
        error: `Agent not found: ${agent_type}`,
        suggestion: "Use orchestrator_agents_list to see available agents",
      };
    }

    // Build agent context
    const details = buildAgentDetails(agent_type, agent);
    const tools = getAgentToolNames(agent);

    // Get service info for the agent's MCP servers
    const serviceRegistry = getServiceRegistry();
    const availableServices = [];
    for (const serverName of agent.assigned_mcp_servers || []) {
      const service = serviceRegistry.get(serverName);
      if (service) {
        availableServices.push({
          name: serverName,
          tools: service.tools.map(t => `${serverName}_${t.name}`),
        });
      }
    }

    // If execution requested, call the Ailumina server via WebSocket
    let chatResponse = null;
    if (execute) {
      console.log(`[orchestrator/chat_route] Executing chat for agent: ${agent_type}`);
      chatResponse = await executeAiluminaChat(agent_type, user_input, chat_messages || []);
    }

    // Return routing and (optional) execution information
    return {
      status: execute ? "executed" : "routed",
      agent: {
        name: agent_type,
        description: agent.description,
        protocol: agent.protocol,
      },
      ...(chatResponse && { response: chatResponse }),
      context: {
        system_prompt: agent.system_prompt,
        available_tools: tools,
        available_services: availableServices,
        can_delegate_to: agent.assigned_agents || [],
      },
      input: {
        user_message: user_input,
        message_count: chat_messages?.length || 0,
      },
      next_steps: {
        message: execute 
          ? "Chat executed via Ailumina bridge." 
          : "Chat routing prepared. Use agents_tools_call to execute tools or pass 'execute: true' to call Ailumina bridge directly.",
        example: {
          tool: "orchestrator_agents_tools_call",
          arguments: {
            agent_name: agent_type,
            tool_name: tools[0] || "memory_semantic_search",
            arguments: { query: user_input },
          },
        },
      },
    };
  } catch (error) {
    console.error("[orchestrator/chat_route] Error:", error);
    throw error;
  }
}
