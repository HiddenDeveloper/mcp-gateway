#!/usr/bin/env bun
/**
 * OpenAPI Specification Generator
 *
 * Generates OpenAPI 3.0 spec from tools.yaml
 * Each MCP tool becomes a REST endpoint with proper schema documentation.
 *
 * Usage:
 *   bun run scripts/generate-openapi.ts
 *
 * Output:
 *   generated/openapi.json
 */

import { parse as parseYaml } from "yaml";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const CONFIG_PATH = join(dirname(import.meta.dir), "config/tools.yaml");
const OUTPUT_PATH = join(dirname(import.meta.dir), "generated/openapi.json");

interface ToolConfig {
  name: string;
  description: string;
  backend: {
    endpoint: string;
    method: string;
    timeout?: string;
  };
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  transform?: {
    wrap_text?: boolean;
  };
  openapi?: {
    tags?: string[];
    summary?: string;
    operationId?: string;
    responses?: Record<string, unknown>;
  };
}

interface Config {
  server: {
    name: string;
    version: string;
    description?: string;
  };
  tools: ToolConfig[];
}

function inferTag(toolName: string): string {
  // Extract tag from tool name prefix
  const parts = toolName.split("_");
  if (parts.length > 1) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  }
  return "General";
}

function toolToPath(tool: ToolConfig): [string, Record<string, unknown>] {
  const method = (tool.backend.method || "POST").toLowerCase();
  const path = `/api/tools/${tool.name}`;

  const operation: Record<string, unknown> = {
    summary: tool.openapi?.summary || tool.description,
    description: tool.description,
    operationId: tool.openapi?.operationId || tool.name,
    tags: tool.openapi?.tags || [inferTag(tool.name)],
  };

  // Request body for POST/PUT/PATCH
  if (["post", "put", "patch"].includes(method)) {
    operation.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: tool.inputSchema,
        },
      },
    };
  } else if (method === "get") {
    // Query parameters for GET
    const parameters: unknown[] = [];
    const props = tool.inputSchema.properties || {};
    const required = tool.inputSchema.required || [];

    for (const [name, prop] of Object.entries(props)) {
      const param: Record<string, unknown> = {
        name,
        in: "query",
        required: required.includes(name),
        schema: prop,
      };
      if ((prop as Record<string, unknown>).description) {
        param.description = (prop as Record<string, unknown>).description;
      }
      parameters.push(param);
    }

    if (parameters.length > 0) {
      operation.parameters = parameters;
    }
  }

  // Default responses
  operation.responses = tool.openapi?.responses || {
    "200": {
      description: "Successful operation",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              result: {
                type: "object",
                description: "Tool execution result",
              },
            },
          },
        },
      },
    },
    "400": {
      description: "Invalid parameters",
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/Error",
          },
        },
      },
    },
    "500": {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/Error",
          },
        },
      },
    },
  };

  return [path, { [method]: operation }];
}

function generateOpenAPI(config: Config): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  const tags = new Set<string>();

  // Convert each tool to an OpenAPI path
  for (const tool of config.tools) {
    const [path, pathItem] = toolToPath(tool);
    paths[path] = pathItem;

    // Collect tags
    const toolTags = tool.openapi?.tags || [inferTag(tool.name)];
    toolTags.forEach((tag) => tags.add(tag));
  }

  // Add MCP endpoints
  paths["/mcp"] = {
    post: {
      summary: "MCP JSON-RPC Endpoint",
      description:
        "Model Context Protocol JSON-RPC 2.0 endpoint. Accepts initialize, tools/list, tools/call, and ping methods.",
      operationId: "mcpJsonRpc",
      tags: ["MCP Protocol"],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/JsonRpcRequest",
            },
          },
        },
      },
      responses: {
        "200": {
          description: "JSON-RPC response",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/JsonRpcResponse",
              },
            },
          },
        },
      },
    },
  };

  tags.add("MCP Protocol");

  // Build OpenAPI spec
  const openApiSpec = {
    openapi: "3.0.3",
    info: {
      title: config.server.name,
      version: config.server.version,
      description:
        config.server.description ||
        "Stone Monkey NGINX MCP Gateway - REST API for MCP tools",
      contact: {
        name: "Stone Monkey Project",
        url: "https://github.com/symagenic/ProjectStoneMonkey",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local development server",
      },
    ],
    tags: Array.from(tags).map((tag) => ({
      name: tag,
      description: `${tag} operations`,
    })),
    paths,
    components: {
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: { type: "integer" },
                message: { type: "string" },
              },
              required: ["code", "message"],
            },
          },
        },
        JsonRpcRequest: {
          type: "object",
          properties: {
            jsonrpc: {
              type: "string",
              enum: ["2.0"],
            },
            method: {
              type: "string",
              enum: ["initialize", "tools/list", "tools/call", "ping"],
            },
            params: {
              type: "object",
            },
            id: {
              oneOf: [{ type: "string" }, { type: "integer" }],
            },
          },
          required: ["jsonrpc", "method", "id"],
        },
        JsonRpcResponse: {
          type: "object",
          properties: {
            jsonrpc: {
              type: "string",
              enum: ["2.0"],
            },
            result: {
              type: "object",
            },
            error: {
              $ref: "#/components/schemas/JsonRpcError",
            },
            id: {
              oneOf: [{ type: "string" }, { type: "integer" }, { type: "null" }],
            },
          },
          required: ["jsonrpc", "id"],
        },
        JsonRpcError: {
          type: "object",
          properties: {
            code: { type: "integer" },
            message: { type: "string" },
            data: { type: "object" },
          },
          required: ["code", "message"],
        },
      },
    },
  };

  return openApiSpec;
}

function main() {
  console.log("Reading tools.yaml...");
  const yamlContent = readFileSync(CONFIG_PATH, "utf8");
  const config = parseYaml(yamlContent) as Config;

  console.log(`Found ${config.tools.length} tools`);

  console.log("Generating OpenAPI spec...");
  const openApiSpec = generateOpenAPI(config);

  // Ensure output directory exists
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });

  console.log(`Writing to ${OUTPUT_PATH}...`);
  writeFileSync(OUTPUT_PATH, JSON.stringify(openApiSpec, null, 2));

  console.log("Done!");
  console.log(`\nGenerated OpenAPI spec with ${config.tools.length} tool endpoints`);
  console.log("View at: http://localhost:3000/api-docs (if swagger-ui is enabled)");
}

main();
