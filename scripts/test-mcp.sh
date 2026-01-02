#!/bin/bash
# MCP Gateway Test Suite
# Tests the full MCP protocol flow with curl

set -e

GATEWAY_URL="${MCP_GATEWAY_URL:-http://localhost:3000}"
BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== NGINX MCP Gateway Test Suite ==="
echo "Gateway: $GATEWAY_URL"
echo "Backend: $BACKEND_URL"
echo ""

# Test 1: Backend health (bypassing MCP)
echo -n "1. Backend health check... "
RESULT=$(curl -s $BACKEND_URL/health 2>/dev/null || echo '{"error":"connection failed"}')
if echo "$RESULT" | grep -q "healthy"; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC} - Backend not responding"
    echo "   Start backend: bun run examples/backend-service.ts"
    exit 1
fi

# Test 2: Gateway health
echo -n "2. Gateway health check... "
RESULT=$(curl -s $GATEWAY_URL/health 2>/dev/null || echo '{"error":"connection failed"}')
if echo "$RESULT" | grep -q "healthy"; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC} - Gateway not responding"
    echo "   Start nginx: nginx (or brew services start nginx-full)"
    exit 1
fi

# Test 3: MCP Initialize
echo -n "3. MCP Initialize... "
RESULT=$(curl -s -X POST $GATEWAY_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test-client", "version": "1.0.0"}
    },
    "id": 1
  }')
if echo "$RESULT" | grep -q '"protocolVersion"'; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "   Response: $RESULT"
    exit 1
fi

# Test 4: Initialize tool registry
echo -n "4. Initialize tool registry... "
RESULT=$(curl -s -X POST $GATEWAY_URL/init)
if echo "$RESULT" | grep -q '"initialized"\|"tools"'; then
    TOOL_COUNT=$(echo "$RESULT" | grep -o '"tools":[0-9]*' | grep -o '[0-9]*' || echo "?")
    echo -e "${GREEN}PASS${NC} ($TOOL_COUNT tools loaded)"
else
    echo -e "${RED}FAIL${NC}"
    echo "   Response: $RESULT"
    echo "   Make sure tools.json exists: bun run scripts/yaml-to-json.ts"
    exit 1
fi

# Test 5: Tools List
echo -n "5. MCP tools/list... "
RESULT=$(curl -s -X POST $GATEWAY_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 2
  }')
if echo "$RESULT" | grep -q '"tools"'; then
    TOOL_COUNT=$(echo "$RESULT" | grep -o '"name"' | wc -l | tr -d ' ')
    echo -e "${GREEN}PASS${NC} ($TOOL_COUNT tools)"
else
    echo -e "${RED}FAIL${NC}"
    echo "   Response: $RESULT"
    exit 1
fi

# Test 6: Tool Call - get_current_time
echo -n "6. MCP tools/call (get_current_time)... "
RESULT=$(curl -s -X POST $GATEWAY_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_current_time",
      "arguments": {}
    },
    "id": 3
  }')
if echo "$RESULT" | grep -q '"content"'; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "   Response: $RESULT"
    exit 1
fi

# Test 7: Tool Call - memory_search
echo -n "7. MCP tools/call (memory_search)... "
RESULT=$(curl -s -X POST $GATEWAY_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "memory_search",
      "arguments": {"query": "test", "limit": 5}
    },
    "id": 4
  }')
if echo "$RESULT" | grep -q '"content"'; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "   Response: $RESULT"
    exit 1
fi

# Test 8: Unknown tool error
echo -n "8. Error handling (unknown tool)... "
RESULT=$(curl -s -X POST $GATEWAY_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "nonexistent_tool",
      "arguments": {}
    },
    "id": 5
  }')
if echo "$RESULT" | grep -q '"error"'; then
    echo -e "${GREEN}PASS${NC} (correctly returned error)"
else
    echo -e "${RED}FAIL${NC} - Should return error for unknown tool"
    echo "   Response: $RESULT"
    exit 1
fi

# Test 9: Ping
echo -n "9. MCP ping... "
RESULT=$(curl -s -X POST $GATEWAY_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "ping",
    "id": 6
  }')
if echo "$RESULT" | grep -q '"result"'; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "   Response: $RESULT"
    exit 1
fi

echo ""
echo -e "${GREEN}=== All tests passed! ===${NC}"
echo ""
echo "The NGINX MCP Gateway is working correctly."
echo "You can now connect MCP clients to: $GATEWAY_URL/mcp"
