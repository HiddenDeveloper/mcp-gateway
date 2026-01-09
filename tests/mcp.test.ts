/**
 * MCP Gateway Tests
 *
 * Organized by:
 * 1. Configuration - Config loading and validation
 * 2. MCP Protocol - JSON-RPC methods and service discovery
 * 3. HTTP Routing - Route matching and error handling
 * 4. Memory Service - Neo4j knowledge graph operations
 * 5. Mesh Service - AI-to-AI communication
 * 6. Recall Service - Conversation history search
 * 7. Orchestrator Service - AI agent orchestration
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
    expect(serviceCard.operations.length).toBe(6);

    // Verify all operations are present
    const opIds = serviceCard.operations.map((op: any) => op.operationId);
    expect(opIds).toContain("semantic_search");
    expect(opIds).toContain("text_search");
    expect(opIds).toContain("get_schema");
    expect(opIds).toContain("execute_cypher");
    expect(opIds).toContain("load_current_focus");
    expect(opIds).toContain("system_status");
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
      // Standalone implementation returns { matches: [...] }
      expect(json.matches).toBeDefined();
      expect(Array.isArray(json.matches)).toBe(true);
    }
  });
});

// =============================================================================
// Mesh Service
// =============================================================================

describe("Mesh Service", () => {
  it("service_card returns all mesh operations", async () => {
    if (skipIfDown()) return;

    const { json } = await callRpc({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "mesh_service_card" },
      id: 20,
    });

    const serviceCard = JSON.parse(json.result.content[0].text);
    expect(serviceCard.service).toBe("mesh");
    expect(serviceCard.operations.length).toBe(7);

    // Verify all operations present
    const opIds = serviceCard.operations.map((op: any) => op.operationId);
    expect(opIds).toContain("subscribe");
    expect(opIds).toContain("leave");
    expect(opIds).toContain("who_is_online");
    expect(opIds).toContain("broadcast");
    expect(opIds).toContain("get_messages");
    expect(opIds).toContain("mark_read");
    expect(opIds).toContain("get_thread");
  });

  it("broadcast operation has full parameter schema", async () => {
    if (skipIfDown()) return;

    const { json } = await callRpc({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "mesh_service_card" },
      id: 21,
    });

    const serviceCard = JSON.parse(json.result.content[0].text);
    const broadcast = serviceCard.operations.find(
      (op: any) => op.operationId === "broadcast"
    );
    expect(broadcast).toBeDefined();
    expect(broadcast.method).toBe("POST");

    // Verify parameters include new fields
    const paramNames = broadcast.parameters.map((p: any) => p.name);
    expect(paramNames).toContain("content");
    expect(paramNames).toContain("to");
    expect(paramNames).toContain("messageType");
    expect(paramNames).toContain("priority");
    expect(paramNames).toContain("requiresResponse");
  });

  it("POST /mesh/subscribe creates session", async () => {
    if (skipIfDown()) return;

    const res = await fetch(`${BASE_URL}/mesh/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantName: "TestAgent",
        capabilities: ["testing"],
      }),
    });
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.session.sessionId).toBeDefined();
    expect(json.session.participantName).toBe("TestAgent");
    expect(json.session.capabilities).toContain("testing");
    expect(json.session.status).toBe("active");
  });

  it("GET /mesh/who_is_online returns participants", async () => {
    if (skipIfDown()) return;

    const res = await fetch(`${BASE_URL}/mesh/who_is_online`);
    const json = await res.json();

    expect(json.participants).toBeInstanceOf(Array);
    expect(json.count).toBeGreaterThanOrEqual(0);
    expect(json.timestamp).toBeDefined();
  });

  it("POST /mesh/broadcast sends message with full features", async () => {
    if (skipIfDown()) return;

    const res = await fetch(`${BASE_URL}/mesh/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Test message from bun test",
        to: "ALL",
        messageType: "thought_share",
        priority: "high",
        requiresResponse: true,
      }),
    });
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.message.id).toBeDefined();
    expect(json.message.fromSession).toBeDefined();
    expect(json.message.toSession).toBe("ALL");
    expect(json.message.messageType).toBe("thought_share");
    expect(json.message.priority).toBe("high");
    expect(json.message.requiresResponse).toBe(true);
  });

  it("GET /mesh/messages retrieves inbox with filters", async () => {
    if (skipIfDown()) return;

    const res = await fetch(`${BASE_URL}/mesh/messages?unreadOnly=false&limit=10`);
    const json = await res.json();

    expect(json.sessionId).toBeDefined();
    expect(json.participantName).toBeDefined();
    expect(json.messages).toBeInstanceOf(Array);
    expect(json.count).toBeGreaterThanOrEqual(0);
  });

  it("POST /mesh/mark_read marks message as read", async () => {
    if (skipIfDown()) return;

    // First broadcast a message to get an ID
    const broadcastRes = await fetch(`${BASE_URL}/mesh/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Message to mark as read" }),
    });
    const broadcastJson = await broadcastRes.json();
    const messageId = broadcastJson.message.id;

    // Mark it as read
    const res = await fetch(`${BASE_URL}/mesh/mark_read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId }),
    });
    const json = await res.json();

    expect(json.messageId).toBe(messageId);
    expect(json.sessionId).toBeDefined();
  });

  it("GET /mesh/thread/{messageId} retrieves thread", async () => {
    if (skipIfDown()) return;

    // First create a message
    const broadcastRes = await fetch(`${BASE_URL}/mesh/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Root message for thread" }),
    });
    const broadcastJson = await broadcastRes.json();
    const messageId = broadcastJson.message.id;

    // Get the thread
    const res = await fetch(`${BASE_URL}/mesh/thread/${messageId}`);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.threadId).toBe(messageId);
    expect(json.messages).toBeInstanceOf(Array);
    expect(json.messages.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// Recall Service
// =============================================================================

describe("Recall Service", () => {
  it("service_card returns structured operations", async () => {
    if (skipIfDown()) return;

    const { json } = await callRpc({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "recall_service_card" },
      id: 30,
    });

    const serviceCard = JSON.parse(json.result.content[0].text);
    expect(serviceCard.service).toBe("recall");
    expect(serviceCard.operations.length).toBe(4);

    // Verify all operations present
    const opIds = serviceCard.operations.map((op: any) => op.operationId);
    expect(opIds).toContain("get_schema");
    expect(opIds).toContain("semantic_search");
    expect(opIds).toContain("text_search");
    expect(opIds).toContain("system_status");
  });

  it("GET /recall/status returns system health", async () => {
    if (skipIfDown()) return;

    const res = await fetch(`${BASE_URL}/recall/status`);
    const json = await res.json();

    // Standalone implementation returns structured status
    expect(json.service).toBe("recall");
    expect(json.healthy).toBeDefined();
    expect(json.qdrant).toBeDefined();
  });

  it("GET /recall/schema returns collection info", async () => {
    if (skipIfDown()) return;

    const res = await fetch(`${BASE_URL}/recall/schema`);
    const json = await res.json();

    // Standalone implementation returns structured schema
    expect(json.collection_name).toBe("conversation-turns");
    expect(json.vector_size).toBeDefined();
    expect(json.payload_schema).toBeDefined();
  });

  it("POST /recall/semantic accepts search params", async () => {
    if (skipIfDown()) return;

    const res = await fetch(`${BASE_URL}/recall/semantic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "test query", limit: 3 }),
    });
    const json = await res.json();

    // Either returns results or embedding error
    if (json.error) {
      expect(json.error).toContain("embedding");
    } else {
      expect(json.query).toBe("test query");
      expect(json.results).toBeDefined();
      expect(json.count).toBeDefined();
    }
  });
});

// =============================================================================
// Orchestrator Service
// =============================================================================

describe("Orchestrator Service", () => {
  it("service_card returns structured operations with sub-domains", async () => {
    if (skipIfDown()) return;

    const { json } = await callRpc({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "orchestrator_service_card" },
      id: 40,
    });

    const serviceCard = JSON.parse(json.result.content[0].text);
    expect(serviceCard.service).toBe("orchestrator");
    expect(serviceCard.operations.length).toBeGreaterThan(20);

    // Verify operations from different sub-domains
    const opIds = serviceCard.operations.map((op: any) => op.operationId);

    // Agents sub-domain
    expect(opIds).toContain("agents_list");
    expect(opIds).toContain("agents_get");
    expect(opIds).toContain("agents_tools_call");

    // Protocols sub-domain
    expect(opIds).toContain("protocols_execute");
    expect(opIds).toContain("protocols_list");

    // Chat sub-domain
    expect(opIds).toContain("chat_route");
    expect(opIds).toContain("chat_status");

    // Admin sub-domain
    expect(opIds).toContain("admin_agents_list");
    expect(opIds).toContain("admin_mcp_list");
  });

  it("GET /orchestrator/chat/status returns health info", async () => {
    if (skipIfDown()) return;

    const res = await fetch(`${BASE_URL}/orchestrator/chat/status`);
    const json = await res.json();

    expect(json.service).toBe("orchestrator");
    expect(json.healthy).toBe(true);
    expect(json.agents).toBeDefined();
    expect(json.agents.count).toBeGreaterThan(0);
    expect(json.services).toBeDefined();
    expect(json.services.names).toContain("memory");
    expect(json.services.names).toContain("mesh");
    expect(json.services.names).toContain("recall");
  });

  it("GET /orchestrator/agents/list returns agent summaries", async () => {
    if (skipIfDown()) return;

    const res = await fetch(`${BASE_URL}/orchestrator/agents/list`);
    const json = await res.json();

    expect(json.agents).toBeInstanceOf(Array);
    expect(json.count).toBeGreaterThan(0);

    // Verify agent summary structure
    const agent = json.agents[0];
    expect(agent.name).toBeDefined();
    expect(agent.description).toBeDefined();
    expect(typeof agent.function_count).toBe("number");
    expect(typeof agent.agent_count).toBe("number");
    expect(typeof agent.mcp_tool_count).toBe("number");
    expect(typeof agent.total_tools).toBe("number");
    expect(agent.mcp_servers).toBeInstanceOf(Array);
  });

  it("POST /orchestrator/agents/get returns agent details", async () => {
    if (skipIfDown()) return;

    // First get list to find an agent name
    const listRes = await fetch(`${BASE_URL}/orchestrator/agents/list`);
    const listJson = await listRes.json();
    const agentName = listJson.agents[0].name;

    // Get agent details
    const res = await fetch(`${BASE_URL}/orchestrator/agents/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_name: agentName }),
    });
    const json = await res.json();

    expect(json.name).toBe(agentName);
    expect(json.description).toBeDefined();
    expect(json.tools).toBeInstanceOf(Array);
  });

  it("POST /orchestrator/agents/search returns ranked results", async () => {
    if (skipIfDown()) return;

    const res = await fetch(`${BASE_URL}/orchestrator/agents/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "memory", limit: 5 }),
    });
    const json = await res.json();

    expect(json.query).toBe("memory");
    expect(json.results).toBeInstanceOf(Array);
    expect(json.count).toBeLessThanOrEqual(5);
    expect(json.total_agents).toBeGreaterThan(0);

    // Verify search results have scores
    if (json.results.length > 0) {
      expect(typeof json.results[0].score).toBe("number");
      expect(json.results[0].match_reasons).toBeInstanceOf(Array);
    }
  });

  it("POST /orchestrator/agents/tools/list returns tool schemas", async () => {
    if (skipIfDown()) return;

    // First get list to find an agent with tools
    const listRes = await fetch(`${BASE_URL}/orchestrator/agents/list`);
    const listJson = await listRes.json();
    const agentWithTools = listJson.agents.find((a: any) => a.total_tools > 0);

    if (!agentWithTools) {
      console.log("No agents with tools found, skipping");
      return;
    }

    const res = await fetch(`${BASE_URL}/orchestrator/agents/tools/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_name: agentWithTools.name }),
    });
    const json = await res.json();

    expect(json.agent_name).toBe(agentWithTools.name);
    expect(json.tools).toBeInstanceOf(Array);
    expect(json.count).toBeGreaterThan(0);

    // Verify tool schema structure
    const tool = json.tools[0];
    expect(tool.name).toBeDefined();
    expect(tool.description).toBeDefined();
    expect(tool.inputSchema).toBeDefined();
    expect(tool.inputSchema.type).toBe("object");
  });

  it("GET /orchestrator/protocols/list returns valid response", async () => {
    if (skipIfDown()) return;

    const res = await fetch(`${BASE_URL}/orchestrator/protocols/list`);
    const json = await res.json();

    expect(json.protocols).toBeInstanceOf(Array);
    expect(json.count).toBeGreaterThanOrEqual(0);
  });
});
