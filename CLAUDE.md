# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Overview

MCP Gateway exposes service discovery via MCP protocol and routes HTTP requests to user-defined functions. The pattern is **LIASE: LLM Is the Application State Engine** — MCP provides discovery, HTTP provides execution, the AI figures out the rest.

## Key Concepts

- **Service cards** are MCP tools that describe HTTP APIs (discovery layer)
- **Paths/operations** are HTTP endpoints (execution layer)
- AI calls `tools/list` → `tools/call {service}_service_card` → direct HTTP calls

## Project Structure

```text
mcp-gateway/
├── src/                        # Core gateway
│   ├── gateway.ts              # Main entry point
│   ├── config.ts               # Config loader and types
│   ├── mcp.ts                  # MCP protocol handler
│   ├── router.ts               # HTTP routing
│   ├── loader.ts               # Service loader
│   └── stdio/
│       └── wrapper.ts          # STDIO transport for Claude Code
│
├── services/                   # Service implementations
│   ├── memory/                 # Neo4j knowledge graph
│   ├── mesh/                   # AI-to-AI communication
│   ├── recall/                 # Conversation history search
│   └── orchestrator/           # Multi-agent workflows
│       └── lib/
│           ├── agent-loader.ts
│           ├── protocol-executor.ts
│           └── service-registry.ts
│
├── config/
│   ├── gateway.json            # Runtime config
│   ├── agents.json             # Agent definitions
│   └── protocols/              # Protocol YAML files
│
├── docs/
│   └── mcp-has-a-gap.md        # LIASE pattern article
│
└── tests/
    ├── config.test.ts
    ├── mcp.test.ts
    └── orchestrator.test.ts
```

## Commands

```bash
bun run src/gateway.ts    # Start gateway
bun test                  # Run all tests
bun test tests/mcp.test.ts # Run specific test
```

## Writing Services

```typescript
// services/{serviceId}/{operationId}.ts
export default async function(params: { query: string; limit?: number }) {
  // Implementation
  return { results: [...] };
}
```

The gateway loads from `services/{serviceId}/{operationId}.ts`, passes merged query/path/body params, returns JSON.

## Configuration

Services defined in `config/gateway.json` following OpenAPI 3.0 structure. Each service needs:
- `servers[0].url` - base URL
- `service_card` - MCP tool metadata
- `paths` - HTTP endpoints mapping to operationIds

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_CONFIG_PATH` | `./config/gateway.json` | Config file |
| `MCP_PORT` | `3000` | Server port |
| `MCP_SERVICES_DIR` | `./services` | Services directory |

## Architecture Notes

- `src/mcp.ts` adds `_meta` to service cards explaining MCP→HTTP pattern
- `src/router.ts` detects MCP-style requests to HTTP endpoints and returns helpful errors
- Orchestrator has its own agent/protocol loaders independent of external dependencies
