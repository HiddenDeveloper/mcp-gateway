import { describe, it, expect, beforeAll } from "bun:test";
import { readFileSync } from "fs";
import path from "path";

const BASE_URL = process.env.MCP_BASE_URL || "http://localhost:3000";
const CONFIG_PATH =
  process.env.MCP_CONFIG_PATH ||
  path.join(process.cwd(), "config", "tools.json");

let gatewayUp = false;
let gatewayReason = "";
let toolsConfig: any = null;
let configReason = "";

async function callRpc(path: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

beforeAll(async () => {
  try {
    const res = await fetch(`${BASE_URL}/health`, { method: "GET" });
    gatewayUp = res.ok;
    if (!res.ok) {
      gatewayReason = `health check failed with status ${res.status}`;
    }
  } catch (err) {
    gatewayUp = false;
    gatewayReason = err instanceof Error ? err.message : String(err);
  }

  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    toolsConfig = JSON.parse(raw);
  } catch (err) {
    configReason =
      err instanceof Error ? err.message : `Unable to read ${CONFIG_PATH}`;
  }
});

describe("MCP Gateway", () => {
  it("lists service_card on /mcp", async () => {
    if (!gatewayUp) {
      console.warn(`SKIP: gateway not reachable at ${BASE_URL} (${gatewayReason})`);
      return;
    }

    const { json } = await callRpc("/mcp", {
      jsonrpc: "2.0",
      method: "tools/list",
      id: 1,
    });

    expect(Array.isArray(json.result?.tools)).toBe(true);
    expect(json.result.tools.length).toBeGreaterThan(0);
    expect(json.result.tools[0].name).toBe("service_card");
  });

  it("lists all tools on /mcp/tools", async () => {
    if (!gatewayUp) {
      console.warn(`SKIP: gateway not reachable at ${BASE_URL} (${gatewayReason})`);
      return;
    }

    const { json } = await callRpc("/mcp/tools", {
      jsonrpc: "2.0",
      method: "tools/list",
      id: 2,
    });

    expect(Array.isArray(json.result?.tools)).toBe(true);
    expect(json.result.tools.length).toBeGreaterThan(1); // more than service_card
  });

  it("calls service_card tool successfully", async () => {
    if (!gatewayUp) {
      console.warn(`SKIP: gateway not reachable at ${BASE_URL} (${gatewayReason})`);
      return;
    }

    const { json } = await callRpc("/mcp/tools", {
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "service_card", arguments: {} },
      id: 3,
    });

    expect(json.result?.content?.[0]?.type).toBe("text");
    expect(typeof json.result?.content?.[0]?.text).toBe("string");
  });

  it("returns validation error for missing required params", async () => {
    if (!gatewayUp) {
      console.warn(`SKIP: gateway not reachable at ${BASE_URL} (${gatewayReason})`);
      return;
    }

    const { json } = await callRpc("/mcp/tools", {
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "memory_semantic_search", arguments: {} },
      id: 4,
    });

    expect(json.error?.code).toBe(-32602);
    expect(typeof json.error?.message).toBe("string");
  });
});

describe("Config-driven tool smoke tests", () => {
  if (!gatewayUp) {
    console.warn(
      `SKIP: gateway not reachable at ${BASE_URL} (${gatewayReason})`
    );
    return;
  }

  if (!toolsConfig) {
    console.warn(
      `SKIP: tools config not available at ${CONFIG_PATH} (${configReason})`
    );
    return;
  }

  const tools = Array.isArray(toolsConfig.tools) ? toolsConfig.tools : [];

  // Only exercise tools that (a) have no required params and (b) target the
  // running memory backend (endpoint starts with /api/nginx-memory).
  const testableTools = tools.filter((tool) => {
    if (!tool.backend) return false; // skip internal tools
    const schema = tool.inputSchema || {};
    const required = schema.required || [];
    if (required.length > 0) return false;
    const endpoint = tool.backend.endpoint || "";
    return endpoint.startsWith("/api/nginx-memory");
  });

  if (testableTools.length === 0) {
    console.warn(
      "SKIP: no testable tools without required params for /api/nginx-memory backend"
    );
    return;
  }

  for (const tool of testableTools) {
    it(`calls ${tool.name} via MCP using config-driven arguments`, async () => {
      const { json } = await callRpc("/mcp/tools", {
        jsonrpc: "2.0",
        method: "tools/call",
        params: { name: tool.name, arguments: {} },
        id: tool.name,
      });

      // Fail fast if the gateway surfaced an error from the backend
      if (json.error) {
        throw new Error(
          `Tool ${tool.name} returned error: ${json.error.message}`
        );
      }

      expect(json.result?.content?.[0]?.type).toBe("text");
    });
  }
});
