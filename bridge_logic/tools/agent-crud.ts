/**
 * Agent CRUD Tools - Self-Evolution API
 * Bridge proxies to server's agent management endpoints
 */

import type { AiluminaToolResponse } from '../types.js';
import { getCurrentTimestamp } from '../utils/ailumina-utils.js';
import { handleError } from '../utils/errors.js';
import { UpdateAgentRequestSchema, type AgentConfigUpdate } from '../schemas/agent-schemas.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8000';

interface GetAgentParams {
  agent_key: string;
}

interface CreateAgentParams {
  agent_key: string;
  config: {
    agent_name: string;            // Required by schema
    service_provider: string;       // Required by schema
    model_name: string;            // Required by schema
    description: string;           // Required by schema
    system_prompt: string;         // Required by schema
    do_stream: boolean;            // Required by schema
    available_functions?: string[];
    temperature?: number;
    max_tokens?: number;
    custom_settings?: Record<string, unknown>;
    mcp_servers?: string[];
  };
}

interface UpdateAgentParams {
  agent_key: string;
  updates: {
    description?: string;
    assigned_functions?: string[];
    assigned_agents?: string[];
    assigned_mcp_servers?: string[];
    system_prompt?: string;
    temperature?: number;
    max_tokens?: number;
    model_name?: string;
  };
}

interface DeleteAgentParams {
  agent_key: string;
}

export class ListAgentsTool {
  async execute(): Promise<AiluminaToolResponse> {
    try {
      const response = await fetch(`${SERVER_URL}/api/agents`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json() as any;

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: result.error || 'Failed to list agents',
                timestamp: getCurrentTimestamp(),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              agents: result.agents,
              count: Object.keys(result.agents).length,
              timestamp: getCurrentTimestamp(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, "list_agents");
    }
  }
}

export class GetAgentTool {
  async execute(params: GetAgentParams): Promise<AiluminaToolResponse> {
    try {
      const { agent_key } = params;

      const response = await fetch(`${SERVER_URL}/api/agents/${encodeURIComponent(agent_key)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json() as any;

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: result.error || 'Failed to get agent',
                timestamp: getCurrentTimestamp(),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              agent: result.agent,
              timestamp: getCurrentTimestamp(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, "get_agent");
    }
  }
}

export class CreateAgentTool {
  async execute(params: CreateAgentParams): Promise<AiluminaToolResponse> {
    try {
      let { agent_key, config } = params;

      // Parse config if it comes as a JSON string
      if (typeof config === 'string') {
        try {
          config = JSON.parse(config);
        } catch (e) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "Invalid config format",
                  message: "config must be a valid JSON object",
                  timestamp: getCurrentTimestamp(),
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
      }

      // Validate required fields before HTTP call
      const errors: string[] = [];
      if (!agent_key) errors.push("agent_key is required");
      if (!config.agent_name) errors.push("config.agent_name is required (display name for the agent)");
      if (!config.service_provider) errors.push("config.service_provider is required (e.g., ANTHROPIC, OPENAI, GOOGLE, OLLAMA)");
      if (!config.model_name) errors.push("config.model_name is required (e.g., claude-3-5-sonnet-20241022)");
      if (!config.description) errors.push("config.description is required (purpose and capabilities)");
      if (!config.system_prompt) errors.push("config.system_prompt is required (defines agent behavior)");
      if (config.do_stream === undefined) errors.push("config.do_stream is required (true for streaming, false for batch)");

      if (errors.length > 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Validation failed: missing required fields",
                missing_fields: errors,
                example: {
                  agent_key: "my_custom_agent",
                  config: {
                    agent_name: "My Custom Agent",
                    service_provider: "ANTHROPIC",
                    model_name: "claude-3-5-sonnet-20241022",
                    description: "Custom agent for specific tasks",
                    system_prompt: "You are a helpful assistant",
                    do_stream: true,
                    available_functions: [],
                    temperature: 0.7,
                  }
                },
                timestamp: getCurrentTimestamp(),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      const response = await fetch(`${SERVER_URL}/api/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentKey: agent_key, config }),
      });

      const result = await response.json() as any;

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: result.error || 'Failed to create agent',
                timestamp: getCurrentTimestamp(),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: result.message,
              agent: result.agent,
              timestamp: getCurrentTimestamp(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, "create_agent");
    }
  }
}

export class UpdateAgentTool {
  async execute(params: unknown): Promise<AiluminaToolResponse> {
    try {
      // Parse updates if it comes as a JSON string
      let parsedParams = params;
      if (typeof params === 'object' && params !== null && 'updates' in params) {
        const p = params as any;
        if (typeof p.updates === 'string') {
          try {
            p.updates = JSON.parse(p.updates);
            parsedParams = p;
          } catch (e) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: "Invalid updates format",
                    message: "updates must be a valid JSON object",
                    timestamp: getCurrentTimestamp(),
                  }, null, 2),
                },
              ],
              isError: true,
            };
          }
        }
      }

      // Validate with Zod schema
      const validation = UpdateAgentRequestSchema.safeParse(parsedParams);

      if (!validation.success) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Validation failed",
                details: validation.error.flatten().fieldErrors,
                timestamp: getCurrentTimestamp(),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      const { agent_key, updates } = validation.data;

      const response = await fetch(`${SERVER_URL}/api/agents/${encodeURIComponent(agent_key)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const result = await response.json() as any;

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: result.error || 'Failed to update agent',
                timestamp: getCurrentTimestamp(),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: result.message,
              agent: result.agent,
              timestamp: getCurrentTimestamp(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, "update_agent");
    }
  }
}

export class DeleteAgentTool {
  async execute(params: DeleteAgentParams): Promise<AiluminaToolResponse> {
    try {
      const { agent_key } = params;

      const response = await fetch(`${SERVER_URL}/api/agents/${encodeURIComponent(agent_key)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json() as any;

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: result.error || 'Failed to delete agent',
                timestamp: getCurrentTimestamp(),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: result.message,
              timestamp: getCurrentTimestamp(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, "delete_agent");
    }
  }
}
