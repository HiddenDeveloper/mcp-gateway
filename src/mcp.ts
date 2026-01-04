/**
 * MCP Protocol Handler
 *
 * Handles MCP JSON-RPC requests for service discovery.
 * Only service_cards are exposed as MCP tools.
 */

import type { GatewayConfig, ServiceConfig } from "./config";

interface JsonRpcRequest {
  jsonrpc: string;
  method: string;
  params?: Record<string, unknown>;
  id: number | string;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: { type: string; properties: Record<string, unknown> };
}

export function createMCPHandler(config: GatewayConfig) {
  // Build service_card tools
  const tools: MCPTool[] = [];

  // Gateway's own service_card
  tools.push({
    name: "service_card",
    description: config.gateway.service_card.summary,
    inputSchema: { type: "object", properties: {} },
  });

  // Each service's service_card
  for (const [serviceId, service] of Object.entries(config.services)) {
    tools.push({
      name: `${serviceId}_service_card`,
      description: service.service_card.summary,
      inputSchema: { type: "object", properties: {} },
    });
  }

  function handleGet(_req: Request): Response {
    const info = config.gateway.info;
    const sc = config.gateway.service_card;

    const lines = [
      `${info.title} v${info.version}`,
      "",
      sc.summary || info.description || "MCP Gateway",
      "",
      "Services:",
      ...Object.entries(config.services).map(
        ([id, s]) => `  - ${id}: ${s.service_card.summary}`
      ),
      "",
      "Use MCP tools/list to discover service_card tools.",
    ];

    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  async function handlePost(req: Request): Promise<Response> {
    let body: JsonRpcRequest;
    try {
      body = await req.json();
    } catch {
      return jsonRpcError(-32700, "Parse error: invalid JSON", null);
    }

    if (body.jsonrpc !== "2.0") {
      return jsonRpcError(-32600, "Invalid Request: must be JSON-RPC 2.0", body.id);
    }

    switch (body.method) {
      case "initialize":
        return handleInitialize(body.id);
      case "tools/list":
        return handleToolsList(body.id);
      case "tools/call":
        return handleToolCall(req, body);
      case "ping":
        return handlePing(body.id);
      default:
        return jsonRpcError(-32601, `Method not found: ${body.method}`, body.id);
    }
  }

  function handleInitialize(id: number | string): Response {
    const info = config.gateway.info;
    return jsonRpcResponse(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: {
        name: info.title,
        version: info.version,
      },
    });
  }

  function handleToolsList(id: number | string): Response {
    return jsonRpcResponse(id, { tools });
  }

  function handleToolCall(req: Request, body: JsonRpcRequest): Response {
    const params = body.params || {};
    const toolName = params.name as string;

    if (!toolName) {
      return jsonRpcError(-32602, "Invalid params: missing tool name", body.id);
    }

    // Gateway service_card
    if (toolName === "service_card") {
      return handleGatewayServiceCard(req, body.id);
    }

    // Service-specific service_card
    for (const [serviceId, service] of Object.entries(config.services)) {
      if (`${serviceId}_service_card` === toolName) {
        return handleServiceCard(serviceId, service, body.id);
      }
    }

    return jsonRpcError(-32602, `Unknown tool: ${toolName}`, body.id);
  }

  function handleGatewayServiceCard(req: Request, id: number | string): Response {
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const info = config.gateway.info;
    const sc = config.gateway.service_card;

    const lines = [
      `${info.title} v${info.version}`,
      "",
      sc.summary || info.description || "MCP Gateway",
      "",
      "Available Services:",
      "",
    ];

    for (const [serviceId, service] of Object.entries(config.services)) {
      const serverUrl = service.servers[0]?.url || "unknown";
      lines.push(`  ${serviceId}_service_card`);
      lines.push(`    ${service.service_card.summary}`);
      lines.push(`    HTTP: ${serverUrl}`);
      lines.push("");
    }

    lines.push("MCP Endpoints:");
    lines.push(`  POST ${baseUrl}/mcp - MCP JSON-RPC protocol`);
    lines.push("");
    lines.push("Call a service_card tool to discover its HTTP API operations.");

    return mcpTextResponse(id, lines.join("\n"));
  }

  function handleServiceCard(
    serviceId: string,
    service: ServiceConfig,
    id: number | string
  ): Response {
    const sc = service.service_card;
    const serverUrl = service.servers[0]?.url || "unknown";
    const paths = service.paths || {};

    // Build structured operations array
    const operations: Array<{
      path: string;
      method: string;
      operationId: string;
      summary: string;
      parameters?: Array<{
        name: string;
        in: string;
        required: boolean;
        type: string;
        default?: unknown;
        description?: string;
      }>;
    }> = [];

    for (const path of Object.keys(paths)) {
      const pathItem = paths[path];
      const methods = ["get", "post", "put", "patch", "delete"] as const;

      for (const method of methods) {
        const operation = pathItem[method];
        if (operation) {
          const params: typeof operations[0]["parameters"] = [];

          // Extract parameters from requestBody schema
          const schema = operation.requestBody?.content?.["application/json"]?.schema;
          if (schema?.properties) {
            for (const [name, prop] of Object.entries(schema.properties)) {
              const propSchema = prop as { type?: string; default?: unknown; description?: string };
              params.push({
                name,
                in: "body",
                required: schema.required?.includes(name) || false,
                type: propSchema.type || "string",
                default: propSchema.default,
                description: propSchema.description,
              });
            }
          }

          // Extract query/path parameters
          if (operation.parameters?.length) {
            for (const param of operation.parameters) {
              params.push({
                name: param.name,
                in: param.in || "query",
                required: param.required || false,
                type: param.schema?.type || "string",
                default: param.schema?.default,
                description: param.description,
              });
            }
          }

          operations.push({
            path,
            method: method.toUpperCase(),
            operationId: operation.operationId,
            summary: operation.summary,
            ...(params.length > 0 && { parameters: params }),
          });
        }
      }
    }

    // Return structured response
    const response = {
      service: serviceId,
      summary: sc.summary,
      description: sc.description,
      baseUrl: serverUrl,
      operations,
    };

    return jsonRpcResponse(id, {
      content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
      isError: false,
    });
  }

  function handlePing(id: number | string): Response {
    return jsonRpcResponse(id, {});
  }

  return { handleGet, handlePost };
}

function jsonRpcResponse(id: number | string | null, result: unknown): Response {
  return Response.json(
    { jsonrpc: "2.0", result, id },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}

function jsonRpcError(code: number, message: string, id: number | string | null): Response {
  return Response.json(
    { jsonrpc: "2.0", error: { code, message }, id },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}

function mcpTextResponse(id: number | string, text: string): Response {
  return jsonRpcResponse(id, {
    content: [{ type: "text", text }],
    isError: false,
  });
}
