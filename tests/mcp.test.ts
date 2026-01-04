/**
 * MCP Gateway Tests
 *
 * Organized by:
 * 1. Configuration - Config loading and validation
 * 2. MCP Protocol - JSON-RPC methods and service discovery
 * 3. HTTP Routing - Route matching and error handling
 * 4. Memory Service - Neo4j knowledge graph operations
 * 5. Mesh Service - AI-to-AI communication
 */

import { describe, it, expect, beforeAll } from "bun:test";

const BASE_URL = process.env.MCP_BASE_URL || "http://localhost:3000";

let gatewayUp = false;
let gatewayReason = "";

async function callRpc(body: unknown) {
  const res = await fetch(`${BASE_URL}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

function skipIfDown() {
  if (!gatewayUp) {
    console.warn(`SKIP: gateway not reachable at ${BASE_URL} (${gatewayReason})`);
    return true;
  }
  return false;
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
});

// =============================================================================
// Configuration
// =============================================================================

describe("Configuration", () => {
  it("gateway loads config and starts", async () => {
    if (skipIfDown()) return;

    const res = await fetch(`${BASE_URL}/health`);
    const json = await res.json();
    expect(json.status).toBe("healthy");
  });

  it("GET /mcp returns gateway info with services", async () => {
    if (skipIfDown()) return;

    const res = await fetch(`${BASE_URL}/mcp`);
    const text = await res.text();
    expect(text).toContain("Services:");
    expect(text).toContain("memory");
    expect(text).toContain("mesh");
  });
});

// =============================================================================
// MCP Protocol
// =============================================================================

describe("MCP Protocol", () => {
  it("tools/list returns only service_card tools", async () => {
    if (skipIfDown()) return;

    const { json } = await callRpc({
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

  it("tools/list includes gateway and service cards", async () => {
    if (skipIfDown()) return;

    const { json } = await callRpc({
      jsonrpc: "2.0",
      method: "tools/list",
      id: 2,
    });

    const toolNames = json.result.tools.map((t: any) => t.name);
    expect(toolNames).toContain("service_card");
    expect(toolNames).toContain("memory_service_card");
    expect(toolNames).toContain("mesh_service_card");
  });

  it("gateway service_card lists available services", async () => {
    if (skipIfDown()) return;

    const { json } = await callRpc({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "service_card" },
      id: 3,
    });

    expect(json.result?.content?.[0]?.type).toBe("text");
    const text = json.result.content[0].text;
    expect(text).toContain("Available Services:");
    expect(text).toContain("memory_service_card");
    expect(text).toContain("mesh_service_card");
  });

  it("service cards return structured JSON with operations", async () => {
    if (skipIfDown()) return;

    const { json } = await callRpc({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "memory_service_card" },
      id: 4,
    });

    expect(json.result?.content?.[0]?.type).toBe("text");
    const serviceCard = JSON.parse(json.result.content[0].text);

    expect(serviceCard.service).toBe("memory");
    expect(serviceCard.baseUrl).toBeDefined();
    expect(serviceCard.operations).toBeInstanceOf(Array);
    expect(serviceCard.operations.length).toBeGreaterThan(0);

    // Verify structured parameter info
    const firstOp = serviceCard.operations[0];
    expect(firstOp.operationId).toBeDefined();
    expect(firstOp.method).toBeDefined();
    expect(firstOp.path).toBeDefined();
    expect(firstOp.parameters).toBeInstanceOf(Array);
  });

  it("operations are NOT exposed as MCP tools", async () => {
    if (skipIfDown()) return;

    const { json } = await callRpc({
      jsonrpc: "2.0",
      method: "tools/list",
      id: 5,
    });

    // Individual operations should not be MCP tools
    const operationNames = [
      "semantic_search",
      "text_search",
      "get_schema",
      "execute_cypher",
      "broadcast",
      "get_messages",
    ];
    for (const tool of json.result.tools) {
      expect(operationNames).not.toContain(tool.name);
    }
  });

  it("ping returns empty result", async () => {
    if (skipIfDown()) return;

    const { json } = await callRpc({
      jsonrpc: "2.0",
      method: "ping",
      id: 6,
    });

    expect(json.result).toBeDefined();
    expect(json.error).toBeUndefined();
  });
});

// =============================================================================
// HTTP Routing
// =============================================================================

describe("HTTP Routing", () => {
  it("routes to correct service based on path prefix", async () => {
    if (skipIfDown()) return;

    // Memory service route - should not 404 (may 500 if Neo4j down)
    const memRes = await fetch(`${BASE_URL}/memory/schema`);
    expect(memRes.status).not.toBe(404);

    // Mesh service route
    const meshRes = await fetch(`${BASE_URL}/mesh/messages`);
    expect(meshRes.status).toBe(200);
  });

  it("unknown route returns 404", async () => {
    if (skipIfDown()) return;

    const res = await fetch(`${BASE_URL}/unknown/route`);
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toBe("Not Found");
  });

  it("unknown service returns 404", async () => {
    if (skipIfDown()) return;

    const res = await fetch(`${BASE_URL}/nonexistent/operation`);
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// Memory Service
// =============================================================================

describe("Memory Service", () => {
  it("service_card returns structured operations", async () => {
    if (skipIfDown()) return;

    const { json } = await callRpc({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "memory_service_card" },
      id: 10,
    });

    const serviceCard = JSON.parse(json.result.content[0].text);
    expect(serviceCard.service).toBe("memory");
    expect(serviceCard.operations.length).toBe(4);

    // Verify all operations are present
    const opIds = serviceCard.operations.map((op: any) => op.operationId);
    expect(opIds).toContain("semantic_search");
    expect(opIds).toContain("text_search");
    expect(opIds).toContain("get_schema");
    expect(opIds).toContain("execute_cypher");
  });

  it("GET /memory/schema returns schema or error", async () => {
    if (skipIfDown()) return;

    const res = await fetch(`${BASE_URL}/memory/schema`);
    const json = await res.json();

    // Accept either real schema or error (Neo4j may not be running)
    expect(json.labels !== undefined || json.error !== undefined).toBe(true);
  });

  it("POST /memory/semantic accepts query params", async () => {
    if (skipIfDown()) return;

    const res = await fetch(`${BASE_URL}/memory/semantic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "test", limit: 5 }),
    });
    const json = await res.json();

    // Real backend returns results or embedding error
    if (json.error) {
      expect(json.error).toContain("embedding");
    } else {
      expect(json.results).toBeDefined();
    }
  });
});

// =============================================================================
// Mesh Service
// =============================================================================

describe("Mesh Service", () => {
  it("service_card returns structured operations", async () => {
    if (skipIfDown()) return;

    const { json } = await callRpc({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "mesh_service_card" },
      id: 20,
    });

    const serviceCard = JSON.parse(json.result.content[0].text);
    expect(serviceCard.service).toBe("mesh");
    expect(serviceCard.operations.length).toBe(2);

    // Verify broadcast operation with parameters
    const broadcast = serviceCard.operations.find(
      (op: any) => op.operationId === "broadcast"
    );
    expect(broadcast).toBeDefined();
    expect(broadcast.method).toBe("POST");
    expect(
      broadcast.parameters.find((p: any) => p.name === "content").required
    ).toBe(true);

    // Verify get_messages operation
    const getMessages = serviceCard.operations.find(
      (op: any) => op.operationId === "get_messages"
    );
    expect(getMessages).toBeDefined();
    expect(getMessages.method).toBe("GET");
  });

  it("POST /mesh/broadcast sends message", async () => {
    if (skipIfDown()) return;

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
    if (skipIfDown()) return;

    const res = await fetch(`${BASE_URL}/mesh/messages?include_read=true`);
    const json = await res.json();

    expect(json.sessionId).toBeDefined();
    expect(json.messages).toBeInstanceOf(Array);
    expect(json.count).toBeGreaterThanOrEqual(0);
  });
});
