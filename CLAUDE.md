# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Gateway - a Bun-based server that exposes service discovery via MCP protocol and routes HTTP requests to user-defined functions.

## Design Philosophy: Hypermedia for AI Agents

This project brings back the original vision of the web: **self-describing, discoverable APIs**.

HTTP and HTML were designed as a hypermedia system where clients don't need external documentation—the response itself contains links describing where you can go and what you can do. REST APIs abandoned this, requiring separate docs for clients to know what endpoints exist.

MCP Gateway restores this pattern for AI agents:

| Original Web | MCP Gateway |
|--------------|-------------|
| Browser starts at URL | Agent connects to `/mcp` |
| HTML describes available links | Service cards describe available operations |
| User clicks links to navigate | Agent calls `tools/list` → `tools/call` |
| No external docs needed | No external docs needed |

**The service card is the modern equivalent of an HTML page with links**—a self-describing resource that tells the agent what it can do next.

```
Agent                          Gateway
  │                               │
  ├── tools/list ────────────────►│
  │◄─── [service_card, memory_service_card, ...] ──│
  │                               │
  ├── tools/call memory_service_card ──────────────►│
  │◄─── "POST /semantic - search, GET /schema..." ──│
  │                               │
  ├── GET /memory/schema ─────────►│  (direct HTTP)
  │◄─── { labels: [...] } ────────│
```

The agent autonomously explores and understands the API surface, just like a browser exploring a website.

## Key Design

- `service_card` endpoints exposed as MCP tools for discovery
- `paths` (operations) routed to services in `services/` directory
- Configuration follows OpenAPI 3.0 structure

## Relationship to Project Stone Monkey

MCP Gateway is designed to replace the MCP server implementations in Project Stone Monkey (`../ProjectStoneMonkey`). Stone Monkey has multiple MCP packages (ai-memory-mcp, ai-mesh-mcp, etc.) each with their own server setup using `@modelcontextprotocol/sdk`.

MCP Gateway consolidates this:
- **Before**: Each service has its own MCP server with SDK boilerplate
- **After**: Services just define functions; gateway handles the protocol

The `services/` directory contains implementations mirrored from Stone Monkey. Tests run against real backends (Neo4j, etc.) to validate that migration will work.

## Project Structure

```text
mcp-gateway/
├── src/                        # Core gateway (standalone, reusable)
│   ├── gateway.ts              # Main entry point
│   ├── config.ts               # Config loader and types
│   ├── mcp.ts                  # MCP protocol handler
│   ├── router.ts               # HTTP routing
│   ├── loader.ts               # Service loader
│   ├── config.schema.json      # JSON Schema for config
│   └── stdio/
│       └── wrapper.ts          # STDIO transport bridge
│
├── services/                   # Service implementations
│   └── memory/
│       ├── get_schema.ts       # Real Neo4j queries
│       ├── semantic_search.ts
│       ├── text_search.ts
│       ├── execute_cypher.ts
│       └── lib/
│           ├── config.ts       # Neo4j connection config
│           └── neo4j-service.js
│
├── config/
│   └── gateway.json            # Runtime config
│
├── public/
│   └── index.html              # Landing page served at /
│
├── examples/
│   └── gateway.json            # Example config
│
└── tests/
    ├── config.test.ts          # Schema validation
    └── mcp.test.ts             # Integration tests (real backends)
```

## Common Commands

```bash
# Start gateway
bun run src/gateway.ts

# Run tests
bun test

# Run specific tests
bun test tests/config.test.ts
bun test tests/mcp.test.ts
```

## Using with Claude Code

The STDIO wrapper allows Claude Code to connect via STDIO transport:

```json
{
  "mcpServers": {
    "my-gateway": {
      "command": "bun",
      "args": ["run", "/path/to/mcp-gateway/src/stdio/wrapper.ts"]
    }
  }
}
```

The gateway must be running (`bun run src/gateway.ts`) before using the wrapper.

## Architecture

```text
                    ┌─────────────────────────────┐
                    │     Bun Gateway (:3000)     │
                    │                             │
MCP Client ────────►│  /mcp  → MCP Handler        │
(HTTP transport)    │         (service discovery) │
                    │                             │
Claude Code ───────►│  STDIO Wrapper ─────────────┼──► /mcp
(STDIO transport)   │  (src/stdio/wrapper.ts)     │
                    │                             │
HTTP Client ───────►│  /{service}/{path}          │
                    │         → Router            │
                    │         → Service Loader    │
                    │         → Service Handler   │
                    └─────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │     services/               │
                    │     └── memory/             │
                    │         ├── get_schema.ts   │
                    │         ├── semantic_search │
                    │         ├── text_search.ts  │
                    │         └── execute_cypher  │
                    └─────────────────────────────┘
```

## Writing Services

Services are TypeScript files that export a default async function:

```typescript
// services/memory/get_schema.ts
import { getNeo4jService, config } from "./lib/config";

interface Params {
  include_statistics?: boolean;
}

export default async function(params: Params) {
  const service = getNeo4jService();
  const schema = await service.getSchema(config.neo4j.database);
  return {
    labels: schema.labels,
    relationshipTypes: schema.relationshipTypes,
  };
}
```

The gateway:

1. Loads services from `services/{serviceId}/{operationId}.ts`
2. Routes HTTP requests to the matching service
3. Passes query params, path params, and body as `params`
4. Returns the service result as JSON

## Configuration Format

```json
{
  "gateway": {
    "info": { "title": "my-gateway", "version": "1.0.0" },
    "service_card": { "operationId": "gateway", "summary": "..." }
  },
  "services": [{
    "servers": [{ "url": "http://localhost:3000/memory" }],
    "service_card": { "operationId": "memory", "summary": "..." },
    "paths": {
      "/schema": {
        "get": { "operationId": "get_schema", "summary": "..." }
      }
    }
  }]
}
```

## Adding New Services

1. Add service to `config/gateway.json`
2. Create service files in `services/{serviceId}/`
3. Restart gateway

## Environment Variables

| Variable | Default | Description |
| ---------- | --------- | ------------- |
| `MCP_CONFIG_PATH` | `./config/gateway.json` | Config file path |
| `MCP_PORT` | `3000` | Server port |
| `MCP_SERVICES_DIR` | `./services` | Services directory |
| `MCP_GATEWAY_URL` | `http://localhost:3000/mcp` | Gateway URL (STDIO wrapper) |
| `MCP_DEBUG` | `false` | Enable debug logging (STDIO wrapper) |
