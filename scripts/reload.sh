#!/bin/bash
# Hot-reload script for NGINX MCP Gateway
# Regenerates tools.json and reloads NGINX

set -e

PROJECT_ROOT=$(cd "$(dirname "$0")/.." && pwd)
GATEWAY_URL="${MCP_GATEWAY_URL:-http://localhost:3000}"

echo "=== Reloading MCP Gateway ==="

# Regenerate JSON config
echo "Converting tools.yaml to tools.json..."
cd "$PROJECT_ROOT"
bun run scripts/yaml-to-json.ts

# Reload NGINX
echo "Reloading NGINX..."
nginx -s reload 2>/dev/null || echo "NGINX not running or reload failed"

# Re-initialize tool registry
echo "Re-initializing tool registry..."
RESULT=$(curl -s -X POST "$GATEWAY_URL/init" 2>/dev/null || echo '{"error":"gateway not responding"}')

if echo "$RESULT" | grep -q "initialized"; then
    TOOL_COUNT=$(echo "$RESULT" | grep -o '"tools":[0-9]*' | grep -o '[0-9]*' || echo "?")
    echo "✅ Reload complete ($TOOL_COUNT tools loaded)"
else
    echo "⚠️  Gateway not responding. Is NGINX running?"
    echo "   Response: $RESULT"
fi
