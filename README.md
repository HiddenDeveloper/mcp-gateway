# NGINX MCP Gateway

**Write pure business logic. Let NGINX handle the protocol.**

This gateway translates MCP (Model Context Protocol) JSON-RPC to standard REST endpoints using NGINX and its njs (JavaScript) module. You write simple REST APIs, NGINX wraps them in MCP format.

## Quick Start (macOS)

### 1. Install NGINX with njs

```bash
./scripts/install-macos.sh
```

This installs `nginx-full` with njs support via Homebrew's denji/nginx tap.

### 2. Setup the gateway

```bash
./scripts/setup.sh
```

This:
- Installs dependencies (yaml parser)
- Converts `tools.yaml` to `tools.json`
- Links NGINX config

### 3. Start the backend

```bash
bun run examples/backend-service.ts
```

Backend runs on port 8080 with mock memory/mesh/facts endpoints.

### 4. Start NGINX

```bash
nginx
# or
brew services start nginx-full
```

Gateway runs on port 3000.

### 5. Initialize & Test

```bash
# Initialize tool registry
curl -X POST http://localhost:3000/init

# Run test suite
./scripts/test-mcp.sh
```

## How It Works

```
MCP Client                    NGINX Gateway                 Your Backend
    │                              │                              │
    │  {"jsonrpc":"2.0",          │                              │
    │   "method":"tools/call",    │                              │
    │   "params":{"name":         │                              │
    │     "memory_search"}}       │                              │
    │ ─────────────────────────>  │                              │
    │                              │  POST /api/memory/search    │
    │                              │  {"query":"test"}            │
    │                              │ ───────────────────────────> │
    │                              │                              │
    │                              │  {"results":[...]}           │
    │                              │ <─────────────────────────── │
    │                              │                              │
    │  {"jsonrpc":"2.0",          │                              │
    │   "result":{"content":      │                              │
    │     [{"type":"text",...}]}} │                              │
    │ <─────────────────────────  │                              │
```

## Adding New Tools

### 1. Add backend endpoint

```typescript
// examples/backend-service.ts
if (path === "/api/my-feature" && method === "POST") {
  const { input } = await req.json();
  return json({ result: "done", input });
}
```

### 2. Add tool definition

```yaml
# config/tools.yaml
tools:
  - name: "my_feature"
    description: "Does the thing"
    backend:
      endpoint: "/api/my-feature"
      method: "POST"
    inputSchema:
      type: "object"
      properties:
        input:
          type: "string"
      required: ["input"]
```

### 3. Reload

```bash
./scripts/reload.sh
```

## File Structure

```
nginx-mcp-gateway/
├── scripts/
│   ├── install-macos.sh    # Install NGINX + njs
│   ├── setup.sh            # Setup development environment
│   ├── yaml-to-json.ts     # Convert tools.yaml → tools.json
│   ├── reload.sh           # Hot-reload configuration
│   └── test-mcp.sh         # Test suite
├── nginx/
│   ├── conf.d/
│   │   └── mcp-gateway.conf  # NGINX server block
│   └── njs/
│       └── mcp-handler.js    # MCP protocol translation
├── config/
│   ├── tools.yaml          # Tool definitions (edit this)
│   └── tools.json          # Generated (don't edit)
└── examples/
    └── backend-service.ts  # Example backend
```

## NGINX Configuration

After setup, you need to configure NGINX to load the njs module and include the gateway config.

Edit `/opt/homebrew/etc/nginx/nginx.conf`:

```nginx
# At the top, before 'events'
load_module /opt/homebrew/lib/nginx/modules/ngx_http_js_module.so;

# Inside the 'http' block, add:
include servers/*.conf;
```

Then test and reload:

```bash
nginx -t && nginx -s reload
```

## Testing with curl

```bash
# Health check
curl http://localhost:3000/health

# Initialize tools
curl -X POST http://localhost:3000/init

# List tools
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Call a tool
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{"name":"get_current_time","arguments":{}},
    "id":2
  }'
```

## Integration with Stone Monkey

Register as an MCP server:

```bash
curl -X POST http://localhost:3004/api/mcp/servers/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "nginx-gateway",
    "url": "http://localhost:3000/mcp",
    "transport": "streamablehttp"
  }'
```

Or add to `server_config.json`:

```json
{
  "mcpServers": {
    "nginx-gateway": {
      "url": "http://localhost:3000/mcp",
      "transport_type": "http"
    }
  }
}
```

## Benefits

1. **No MCP in your code** - Write standard REST APIs
2. **Test with curl** - Debug without MCP clients
3. **Declarative tools** - Add tools via YAML config
4. **NGINX performance** - Battle-tested infrastructure
5. **Gradual adoption** - Works alongside existing MCP servers
