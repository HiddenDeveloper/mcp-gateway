/**
 * Service Registry
 *
 * Maps MCP service names to gateway endpoints and tool definitions.
 * Used for tool discovery and routing.
 */

import { GATEWAY_URL } from "./config";
import type { ServiceConfig, ServiceToolConfig, ToolSchema } from "./types";

// ============================================================================
// Service Definitions
// ============================================================================

const SERVICES: Record<string, ServiceConfig> = {
  memory: {
    baseUrl: "/memory",
    tools: [
      {
        name: "semantic_search",
        endpoint: "/semantic",
        method: "POST",
        description: "Search knowledge graph by semantic meaning using vector similarity",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query text" },
            limit: { type: "number", description: "Maximum results to return", default: 10 },
            targetLabels: { type: "array", items: { type: "string" }, description: "Node labels to search" },
          },
          required: ["query"],
        },
      },
      {
        name: "text_search",
        endpoint: "/text",
        method: "POST",
        description: "Search knowledge graph by keyword matching in text properties",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query text" },
            limit: { type: "number", description: "Maximum results to return", default: 10 },
            targetLabels: { type: "array", items: { type: "string" }, description: "Node labels to search" },
          },
          required: ["query"],
        },
      },
      {
        name: "get_schema",
        endpoint: "/schema",
        method: "GET",
        description: "Get knowledge graph schema including node labels and relationship types",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "execute_cypher",
        endpoint: "/cypher",
        method: "POST",
        description: "Execute Cypher query on knowledge graph (READ or WRITE mode)",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Cypher query to execute" },
            params: { type: "object", description: "Query parameters" },
            mode: { type: "string", enum: ["READ", "WRITE"], default: "READ" },
          },
          required: ["query"],
        },
      },
    ],
  },

  mesh: {
    baseUrl: "/mesh",
    tools: [
      {
        name: "subscribe",
        endpoint: "/subscribe",
        method: "POST",
        description: "Subscribe to mesh network with participant identity",
        inputSchema: {
          type: "object",
          properties: {
            participantName: { type: "string", description: "Name of the participant" },
            capabilities: { type: "array", items: { type: "string" }, description: "Participant capabilities" },
          },
          required: ["participantName"],
        },
      },
      {
        name: "leave",
        endpoint: "/leave",
        method: "POST",
        description: "Leave the mesh network",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Session ID from subscribe" },
          },
          required: ["sessionId"],
        },
      },
      {
        name: "who_is_online",
        endpoint: "/who_is_online",
        method: "GET",
        description: "List all participants currently online in the mesh",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "broadcast",
        endpoint: "/broadcast",
        method: "POST",
        description: "Broadcast a message to mesh network participants",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Session ID from subscribe" },
            content: { type: "string", description: "Message content" },
            to: { type: "string", description: "Optional recipient session ID" },
            messageType: { type: "string", description: "Type of message" },
            priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
            requiresResponse: { type: "boolean", description: "Whether response is expected" },
          },
          required: ["sessionId", "content"],
        },
      },
      {
        name: "get_messages",
        endpoint: "/messages",
        method: "GET",
        description: "Get messages for a participant",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Session ID" },
            unreadOnly: { type: "boolean", description: "Only return unread messages" },
            limit: { type: "number", description: "Maximum messages to return" },
          },
          required: ["sessionId"],
        },
      },
      {
        name: "mark_read",
        endpoint: "/mark_read",
        method: "POST",
        description: "Mark messages as read",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Session ID" },
            messageIds: { type: "array", items: { type: "string" }, description: "Message IDs to mark read" },
          },
          required: ["sessionId", "messageIds"],
        },
      },
      {
        name: "get_thread",
        endpoint: "/thread/{messageId}",
        method: "GET",
        description: "Get a message thread by ID",
        inputSchema: {
          type: "object",
          properties: {
            messageId: { type: "string", description: "Message ID" },
          },
          required: ["messageId"],
        },
      },
    ],
  },

  recall: {
    baseUrl: "/recall",
    tools: [
      {
        name: "semantic_search",
        endpoint: "/semantic",
        method: "POST",
        description: "Search conversation history by semantic meaning",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query text" },
            limit: { type: "number", description: "Maximum results", default: 10 },
            threshold: { type: "number", description: "Similarity threshold", default: 0.7 },
            filters: { type: "object", description: "Filter criteria" },
          },
          required: ["query"],
        },
      },
      {
        name: "text_search",
        endpoint: "/text",
        method: "POST",
        description: "Search conversation history by keyword",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query text" },
            limit: { type: "number", description: "Maximum results", default: 10 },
            fields: { type: "array", items: { type: "string" }, description: "Fields to search" },
            provider: { type: "string", description: "Filter by AI provider" },
            date_from: { type: "string", description: "Start date (ISO 8601)" },
            date_to: { type: "string", description: "End date (ISO 8601)" },
          },
          required: ["query"],
        },
      },
      {
        name: "get_schema",
        endpoint: "/schema",
        method: "GET",
        description: "Get conversation collection schema",
        inputSchema: {
          type: "object",
          properties: {
            include_statistics: { type: "boolean", default: true },
          },
        },
      },
      {
        name: "system_status",
        endpoint: "/status",
        method: "GET",
        description: "Check recall system health",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  },

  orchestrator: {
    baseUrl: "/orchestrator",
    tools: [
      {
        name: "agents_list",
        endpoint: "/agents/list",
        method: "GET",
        description: "List available agents",
        inputSchema: {
          type: "object",
          properties: {
            mcp_server: { type: "string", description: "Filter by MCP server name" },
            limit: { type: "number", description: "Maximum agents to return" },
          },
        },
      },
      {
        name: "agents_get",
        endpoint: "/agents/get",
        method: "POST",
        description: "Get agent details",
        inputSchema: {
          type: "object",
          properties: {
            agent_name: { type: "string", description: "Name of the agent" },
          },
          required: ["agent_name"],
        },
      },
      {
        name: "agents_search",
        endpoint: "/agents/search",
        method: "POST",
        description: "Search for agents",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            limit: { type: "number", description: "Maximum results" },
            fuzzy: { type: "boolean", description: "Enable fuzzy matching" },
          },
          required: ["query"],
        },
      },
      {
        name: "agents_tools_list",
        endpoint: "/agents/tools/list",
        method: "POST",
        description: "List agent's tools",
        inputSchema: {
          type: "object",
          properties: {
            agent_name: { type: "string", description: "Name of the agent" },
          },
          required: ["agent_name"],
        },
      },
      {
        name: "agents_tools_call",
        endpoint: "/agents/tools/call",
        method: "POST",
        description: "Call agent's tool",
        inputSchema: {
          type: "object",
          properties: {
            agent_name: { type: "string", description: "Name of the agent" },
            tool_name: { type: "string", description: "Name of the tool" },
            arguments: { type: "object", description: "Tool arguments" },
          },
          required: ["agent_name", "tool_name"],
        },
      },
      {
        name: "protocols_list",
        endpoint: "/protocols/list",
        method: "GET",
        description: "List workflow protocols",
        inputSchema: {
          type: "object",
          properties: {
            category: { type: "string", description: "Filter by category" },
          },
        },
      },
      {
        name: "protocols_execute",
        endpoint: "/protocols/execute",
        method: "POST",
        description: "Execute a protocol",
        inputSchema: {
          type: "object",
          properties: {
            protocol_name: { type: "string", description: "Name of the protocol" },
            input: { type: "object", description: "Protocol input parameters" },
            async: { type: "boolean", description: "Run asynchronously" },
          },
          required: ["protocol_name"],
        },
      },
      {
        name: "protocols_status",
        endpoint: "/protocols/status",
        method: "POST",
        description: "Get protocol job status",
        inputSchema: {
          type: "object",
          properties: {
            job_id: { type: "string", description: "Job ID" },
          },
          required: ["job_id"],
        },
      },
      {
        name: "chat_status",
        endpoint: "/chat/status",
        method: "GET",
        description: "Get orchestrator status",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  },
};

// ============================================================================
// Registry Access
// ============================================================================

let serviceRegistry: Map<string, ServiceConfig> | null = null;

/**
 * Get the service registry
 */
export function getServiceRegistry(): Map<string, ServiceConfig> {
  if (!serviceRegistry) {
    serviceRegistry = new Map(Object.entries(SERVICES));
  }
  return serviceRegistry;
}

/**
 * Get a specific service by name
 */
export function getService(name: string): ServiceConfig | undefined {
  return getServiceRegistry().get(name);
}

/**
 * Get tool configuration by full name (server_toolname)
 */
export function getToolConfig(fullToolName: string): { service: ServiceConfig; tool: ServiceToolConfig } | undefined {
  const parts = fullToolName.split("_");
  if (parts.length < 2) return undefined;

  const serverName = parts[0];
  const toolName = parts.slice(1).join("_");

  const service = getService(serverName);
  if (!service) return undefined;

  const tool = service.tools.find(t => t.name === toolName);
  if (!tool) return undefined;

  return { service, tool };
}

/**
 * Build full endpoint URL for a tool
 */
export function buildToolEndpoint(serviceName: string, tool: ServiceToolConfig): string {
  return `${GATEWAY_URL}${SERVICES[serviceName]?.baseUrl || ""}${tool.endpoint}`;
}

/**
 * Convert ServiceToolConfig to ToolSchema format
 */
export function toToolSchema(serviceName: string, tool: ServiceToolConfig): ToolSchema {
  return {
    name: `${serviceName}_${tool.name}`,
    description: tool.description,
    inputSchema: tool.inputSchema || {
      type: "object",
      properties: {},
    },
  };
}

/**
 * Get all tool schemas for a service
 */
export function getServiceToolSchemas(serviceName: string): ToolSchema[] {
  const service = getService(serviceName);
  if (!service) return [];

  return service.tools.map(tool => toToolSchema(serviceName, tool));
}

/**
 * Get tool schemas for specific tools from a service
 */
export function getFilteredToolSchemas(serviceName: string, toolNames: string[]): ToolSchema[] {
  const service = getService(serviceName);
  if (!service) return [];

  return service.tools
    .filter(tool => toolNames.includes(tool.name))
    .map(tool => toToolSchema(serviceName, tool));
}
