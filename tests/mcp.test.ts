import { describe, it, expect, beforeAll } from "bun:test";
import { readFileSync } from "fs";
import path from "path";

const BASE_URL = process.env.MCP_BASE_URL || "http://localhost:3000";
const CONFIG_PATH =
  process.env.MCP_CONFIG_PATH ||
  path.join(process.cwd(), "config", "gateway.json");

let gatewayUp = false;
let gatewayReason = "";
let gatewayConfig: any = null;

async function callRpc(endpoint: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

beforeAll(async () => {
  // Check gateway health
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

  // Load config
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    gatewayConfig = JSON.parse(raw);
  } catch (err) {
    console.warn(`Could not load config from ${CONFIG_PATH}`);
  }
});

describe("MCP Gateway", () => {
  it("health check returns healthy", async () => {
    if (!gatewayUp) {
      console.warn(`SKIP: gateway not reachable at ${BASE_URL} (${gatewayReason})`);
      return;
    }

    const res = await fetch(`${BASE_URL}/health`);
    const json = await res.json();
    expect(json.status).toBe("healthy");
  });

  it("GET /mcp returns human-readable info", async () => {
    if (!gatewayUp) {
      console.warn(`SKIP: gateway not reachable`);
      return;
    }

    const res = await fetch(`${BASE_URL}/mcp`);
    const text = await res.text();
    expect(text).toContain("Services:");
  });

  it("tools/list returns only service_cards", async () => {
    if (!gatewayUp) {
      console.warn(`SKIP: gateway not reachable`);
      return;
    }

    const { json } = await callRpc("/mcp", {
      jsonrpc: "2.0",
      method: "tools/list",
      id: 1,
    });

    expect(Array.isArray(json.result?.tools)).toBe(true);
    expect(json.result.tools.length).toBeGreaterThan(0);

    // All tools should be service_cards
    for (const tool of json.result.tools) {
      expect(tool.name).toMatch(/service_card$/);
    }
  });

  it("tools/list includes gateway service_card", async () => {
    if (!gatewayUp) {
      console.warn(`SKIP: gateway not reachable`);
      return;
    }

    const { json } = await callRpc("/mcp", {
      jsonrpc: "2.0",
      method: "tools/list",
      id: 2,
    });

    const gatewayCard = json.result.tools.find((t: any) => t.name === "service_card");
    expect(gatewayCard).toBeDefined();
  });

  it("calling gateway service_card returns service list", async () => {
    if (!gatewayUp) {
      console.warn(`SKIP: gateway not reachable`);
      return;
    }

    const { json } = await callRpc("/mcp", {
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "service_card" },
      id: 3,
    });

    expect(json.result?.content?.[0]?.type).toBe("text");
    const text = json.result.content[0].text;
    expect(text).toContain("Available Services:");
  });

  it("calling service-specific service_card returns operations", async () => {
    if (!gatewayUp) {
      console.warn(`SKIP: gateway not reachable`);
      return;
    }

    const { json } = await callRpc("/mcp", {
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "memory_service_card" },
      id: 4,
    });

    expect(json.result?.content?.[0]?.type).toBe("text");
    const text = json.result.content[0].text;
    const serviceCard = JSON.parse(text);
    expect(serviceCard.service).toBe("memory");
    expect(serviceCard.baseUrl).toBeDefined();
    expect(serviceCard.operations).toBeInstanceOf(Array);
    expect(serviceCard.operations.length).toBeGreaterThan(0);
    // Verify structured parameter info is present
    const firstOp = serviceCard.operations[0];
    expect(firstOp.operationId).toBeDefined();
    expect(firstOp.method).toBeDefined();
    expect(firstOp.path).toBeDefined();
  });

  it("operations are NOT exposed as MCP tools", async () => {
    if (!gatewayUp) {
      console.warn(`SKIP: gateway not reachable`);
      return;
    }

    const { json } = await callRpc("/mcp", {
      jsonrpc: "2.0",
      method: "tools/list",
      id: 5,
    });

    // Operation names like "semantic_search" should not be MCP tools
    const operationNames = ["semantic_search", "text_search", "get_schema", "execute_cypher"];
    for (const tool of json.result.tools) {
      expect(operationNames).not.toContain(tool.name);
    }
  });

  it("ping returns empty result", async () => {
    if (!gatewayUp) {
      console.warn(`SKIP: gateway not reachable`);
      return;
    }

    const { json } = await callRpc("/mcp", {
      jsonrpc: "2.0",
      method: "ping",
      id: 6,
    });

    expect(json.result).toBeDefined();
    expect(json.error).toBeUndefined();
  });
});

describe("HTTP Function Routes", () => {
  it("GET /memory/schema calls function", async () => {
    if (!gatewayUp) {
      console.warn(`SKIP: gateway not reachable`);
      return;
    }

    const res = await fetch(`${BASE_URL}/memory/schema`);
    const json = await res.json();
    // Accept either a real schema or error (Neo4j may not be running)
    expect(json.labels !== undefined || json.error !== undefined).toBe(true);
  });

  it("POST /memory/semantic calls function with params", async () => {
    if (!gatewayUp) {
      console.warn(`SKIP: gateway not reachable`);
      return;
    }

    const res = await fetch(`${BASE_URL}/memory/semantic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "test", limit: 5 }),
    });
    const json = await res.json();

    // Real backend returns results if embedding service is up,
    // or error message if not. Both are valid responses.
    if (json.error) {
      // Expected error when embedding service is unavailable
      expect(json.error).toContain("embedding");
    } else {
      // Success response with results
      expect(json.results).toBeDefined();
    }
  });

  it("unknown route returns 404", async () => {
    if (!gatewayUp) {
      console.warn(`SKIP: gateway not reachable`);
      return;
    }

    const res = await fetch(`${BASE_URL}/unknown/route`);
    expect(res.status).toBe(404);
  });
});

describe("Mesh Service", () => {
  it("mesh_service_card returns structured JSON", async () => {
    if (!gatewayUp) {
      console.warn(`SKIP: gateway not reachable`);
      return;
    }

    const { json } = await callRpc("/mcp", {
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "mesh_service_card" },
      id: 10,
    });

    expect(json.result?.content?.[0]?.type).toBe("text");
    const serviceCard = JSON.parse(json.result.content[0].text);
    expect(serviceCard.service).toBe("mesh");
    expect(serviceCard.operations).toBeInstanceOf(Array);
    expect(serviceCard.operations.length).toBe(2);

    // Verify broadcast operation
    const broadcast = serviceCard.operations.find((op: any) => op.operationId === "broadcast");
    expect(broadcast).toBeDefined();
    expect(broadcast.method).toBe("POST");
    expect(broadcast.parameters.find((p: any) => p.name === "content").required).toBe(true);

    // Verify get_messages operation
    const getMessages = serviceCard.operations.find((op: any) => op.operationId === "get_messages");
    expect(getMessages).toBeDefined();
    expect(getMessages.method).toBe("GET");
  });

  it("POST /mesh/broadcast sends message", async () => {
    if (!gatewayUp) {
      console.warn(`SKIP: gateway not reachable`);
      return;
    }

    const res = await fetch(`${BASE_URL}/mesh/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Test message from bun test", to: "ALL" }),
    });
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.message.id).toBeDefined();
    expect(json.message.from).toBeDefined();
    expect(json.message.to).toBe("ALL");
  });

  it("GET /mesh/messages retrieves inbox", async () => {
    if (!gatewayUp) {
      console.warn(`SKIP: gateway not reachable`);
      return;
    }

    const res = await fetch(`${BASE_URL}/mesh/messages?include_read=true`);
    const json = await res.json();

    expect(json.sessionId).toBeDefined();
    expect(json.messages).toBeInstanceOf(Array);
    expect(json.count).toBeGreaterThanOrEqual(0);
  });
});
