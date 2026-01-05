/**
 * Create Agent (Admin)
 *
 * Create a new agent configuration.
 *
 * Standalone implementation - no external dependencies.
 */

import { createAgent, buildAgentDetails } from "./lib/agent-loader";

interface CreateAgentParams {
  name: string;
  description: string;
  system_prompt: string;
  assigned_functions?: string[];
  assigned_agents?: string[];
  assigned_mcp_servers?: string[];
  protocol?: string;
}

export default async function (params: Record<string, unknown>) {
  const {
    name,
    description,
    system_prompt,
    assigned_functions,
    assigned_agents,
    assigned_mcp_servers,
    protocol,
  } = params as CreateAgentParams;

  if (!name) {
    throw new Error("Missing required parameter: name");
  }
  if (!description) {
    throw new Error("Missing required parameter: description");
  }
  if (!system_prompt) {
    throw new Error("Missing required parameter: system_prompt");
  }

  try {
    const agent = await createAgent(name, {
      description,
      system_prompt,
      assigned_functions: assigned_functions || [],
      assigned_agents: assigned_agents || [],
      assigned_mcp_servers: assigned_mcp_servers || [],
      protocol,
    });

    return {
      status: "created",
      agent: buildAgentDetails(name, agent),
    };
  } catch (error) {
    console.error("[orchestrator/admin/agents_create] Error:", error);
    throw error;
  }
}
