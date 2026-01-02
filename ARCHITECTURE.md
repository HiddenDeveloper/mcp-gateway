# NGINX MCP Gateway Architecture

## Vision

**Write pure business logic. Let NGINX handle the protocol.**

This architecture allows you to build tools and functions as simple REST endpoints or WebSocket handlers, while NGINX automatically wraps them in the MCP (Model Context Protocol) format. You never think about MCP - you just write functions.

## Core Concept

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MCP Client (Claude)                          │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ MCP JSON-RPC
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      NGINX MCP Gateway                              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  njs Module (JavaScript)                                       │ │
│  │  • Parse MCP JSON-RPC requests                                 │ │
│  │  • Route to backend based on tool name                         │ │
│  │  • Transform responses to MCP format                           │ │
│  │  • Handle tool discovery (tools/list)                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Tool Schema Registry (YAML/JSON config)                       │ │
│  │  • Tool definitions with inputSchema                           │ │
│  │  • Backend endpoint mappings                                   │ │
│  │  • Response transformations                                    │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ Standard HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Your Backend Services                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   /api/foo   │  │  /api/bar    │  │  /api/baz    │              │
│  │  Pure REST   │  │  Pure REST   │  │  Pure REST   │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

## How It Works

### 1. MCP Request Flow

```
Client sends:
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "search_memory",
    "arguments": { "query": "consciousness" }
  },
  "id": 1
}

NGINX translates to:
POST /api/memory/search
Content-Type: application/json
{ "query": "consciousness" }

Backend responds:
{ "results": [...], "count": 5 }

NGINX wraps as MCP:
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"results\":[...],\"count\":5}"
    }]
  },
  "id": 1
}
```

### 2. Tool Discovery

When an MCP client requests `tools/list`, NGINX reads the tool registry and returns all configured tools with their schemas - no backend involvement needed.

### 3. Transport Modes

The gateway supports both MCP transport modes:

- **HTTP+SSE (Streamable HTTP)**: POST for requests, SSE for streaming responses
- **WebSocket**: Full duplex for real-time communication

## Benefits

1. **Clean Separation**: Business logic knows nothing about MCP
2. **Reusability**: Same backend serves MCP clients, REST clients, or anything else
3. **Testability**: Test your functions with simple curl commands
4. **Flexibility**: Add/remove/modify tools by editing config, no code changes
5. **Performance**: NGINX's proven efficiency handles protocol overhead
6. **Gradual Migration**: Wrap existing APIs without modification

## Stone Monkey Integration

This architecture can sit alongside or replace your current MCP servers:

```
Current:
  Claude.ai → Stone Monkey Bridge → Individual MCP Servers

With NGINX Gateway:
  Claude.ai → Stone Monkey Bridge → NGINX MCP Gateway → Your Services
                                  ↓
                            (Also can route to existing MCP servers)
```

The gateway can coexist with your existing infrastructure, allowing gradual migration.

## File Structure

```
nginx-mcp-gateway/
├── ARCHITECTURE.md          # This document
├── nginx/
│   ├── nginx.conf           # Main NGINX configuration
│   ├── mcp-gateway.conf     # MCP-specific server block
│   └── njs/
│       ├── mcp-handler.js   # MCP protocol handling
│       └── tool-router.js   # Request routing logic
├── config/
│   └── tools.yaml           # Tool definitions and mappings
├── examples/
│   └── backend-service.ts   # Example backend implementation
└── docker/
    └── Dockerfile           # Container setup
```

## Next Steps

1. Review the tool configuration format in `config/tools.yaml`
2. Examine the njs handler code in `nginx/njs/mcp-handler.js`
3. Run the example backend and test the gateway
4. Adapt for your Stone Monkey services
