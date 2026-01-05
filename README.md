# MCP Gateway

A Bun-based gateway that brings back the original vision of the web: **self-describing, discoverable APIs for AI agents**.

## Why This Exists

HTTP and HTML were designed as a hypermedia system—clients don't need external documentation because responses contain links describing available actions. REST APIs abandoned this, requiring separate docs for clients to know what endpoints exist.

MCP Gateway restores this pattern for AI agents:

| Original Web | MCP Gateway |
|--------------|-------------|
| Browser starts at URL | Agent connects to `/mcp` |
| HTML describes available links | Service cards describe available operations |
| User clicks links to navigate | Agent calls `tools/list` → `tools/call` |
| No external docs needed | No external docs needed |

**The service card is the modern equivalent of an HTML page with links**—a self-describing resource that tells the agent what it can do next.

## How It Works

```
Agent                          Gateway
  │                               │
  ├── tools/list ────────────────►│
  │◄─── [gateway, memory, mesh] ──│
  │                               │
  ├── tools/call memory ──────────►│
  │◄─── "POST /semantic, GET /schema, ..." ──│
  │                               │
  ├── GET /memory/schema ─────────►│  (direct HTTP)
  │◄─── { labels: [...] } ────────│
```

The agent autonomously explores and understands the API surface, just like a browser exploring a website.

## Features

- **Self-Describing APIs**: Service discovery via MCP protocol (JSON-RPC 2.0)
- **OpenAPI-Compatible Config**: Define services using familiar OpenAPI structure
- **Dynamic Service Loading**: Drop TypeScript files in `services/` and they're auto-loaded
- **STDIO Transport**: Connect Claude Code directly via STDIO wrapper
- **Zero Dependencies**: Pure Bun, no external runtime dependencies

## Quick Start

```bash
# Clone and install
git clone https://github.com/HiddenDeveloper/mcp-gateway
cd mcp-gateway
bun install

# Start the gateway
bun run src/gateway.ts
```

Visit `http://localhost:3000` to see the gateway landing page.

## Usage

### MCP Discovery

```bash
# List available services
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'

# Get service details
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "memory_service_card"}, "id": 2}'
```

### Direct HTTP Calls

```bash
# Call operations directly
curl http://localhost:3000/memory/schema
curl -X POST http://localhost:3000/memory/semantic -d '{"query": "search term"}'
```

## Claude Code Integration

Add to your Claude Code MCP settings:

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

The gateway must be running before using the wrapper.

## Architecture

```
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

## Configuration

### Config File

Create `config/gateway.json`:

```json
{
  "gateway": {
    "info": { "title": "my-gateway", "version": "1.0.0" },
    "service_card": {
      "operationId": "gateway",
      "summary": "Gateway service discovery"
    }
  },
  "services": [{
    "servers": [{ "url": "http://localhost:3000/memory" }],
    "service_card": {
      "operationId": "memory",
      "summary": "Memory service"
    },
    "paths": {
      "/schema": {
        "get": {
          "operationId": "get_schema",
          "summary": "Get database schema"
        }
      }
    }
  }]
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_CONFIG_PATH` | `./config/gateway.json` | Config file path |
| `MCP_PORT` | `3000` | Server port |
| `MCP_SERVICES_DIR` | `./services` | Services directory |
| `MCP_GATEWAY_URL` | `http://localhost:3000/mcp` | Gateway URL (STDIO wrapper) |
| `MCP_DEBUG` | `false` | Debug logging (STDIO wrapper) |

## Writing Services

Services are TypeScript files that export a default async function:

```typescript
// services/memory/semantic_search.ts
import { getNeo4jService } from "./lib/config";

interface Params {
  query: string;
  limit?: number;
  threshold?: number;
}

export default async function(params: Params) {
  const { query, limit = 10, threshold = 0.7 } = params;
  const service = getNeo4jService();

  const results = await service.semanticSearch(query, ["KnowledgeItem"], "embedding_vectors", limit);

  return { matches: results.filter(r => r.score >= threshold) };
}
```

The gateway:
1. Loads services from `services/{serviceId}/{operationId}.ts`
2. Routes HTTP requests to the matching service
3. Passes query params, path params, and body as `params`
4. Returns the service result as JSON

## MCP Protocol

| Method | Path | Description |
|--------|------|-------------|
| GET | `/mcp` | Server info and capabilities |
| POST | `/mcp` | JSON-RPC 2.0 protocol |
| GET | `/health` | Health check |
| GET | `/` | Landing page |

### Supported JSON-RPC Methods

- `initialize` - Initialize MCP connection
- `tools/list` - List available service cards
- `tools/call` - Get service details (returns operations)
- `ping` - Health check

## Development

```bash
# Run tests
bun test

# Run specific tests
bun test tests/config.test.ts
bun test tests/mcp.test.ts
```

## License

MIT
