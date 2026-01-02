#!/bin/bash
# Setup script for NGINX MCP Gateway
# Run this after install-macos.sh

set -e

PROJECT_ROOT=$(cd "$(dirname "$0")/.." && pwd)

echo "=== Setting up NGINX MCP Gateway ==="
echo "Project root: $PROJECT_ROOT"
echo ""

# Check for bun
if ! command -v bun &> /dev/null; then
    echo "ERROR: Bun not found. Install from https://bun.sh"
    exit 1
fi

# Install yaml package for converter
echo "Installing dependencies..."
cd "$PROJECT_ROOT"
bun add yaml

# Convert YAML to JSON
echo ""
echo "Converting tools.yaml to tools.json..."
bun run scripts/yaml-to-json.ts

# Check nginx installation
echo ""
if ! command -v nginx &> /dev/null; then
    echo "WARNING: nginx not found in PATH"
    echo "Run: ./scripts/install-macos.sh"
else
    echo "NGINX found: $(which nginx)"

    # Check for njs module
    if nginx -V 2>&1 | grep -q "njs"; then
        echo "njs module: INSTALLED"
    else
        echo "WARNING: njs module not detected"
        echo "You may need: brew install nginx-full --with-njs"
    fi
fi

# Create nginx servers directory if needed
NGINX_SERVERS_DIR="/opt/homebrew/etc/nginx/servers"
if [ -d "/opt/homebrew/etc/nginx" ]; then
    mkdir -p "$NGINX_SERVERS_DIR"

    # Symlink our config
    echo ""
    echo "Linking NGINX configuration..."
    ln -sf "$PROJECT_ROOT/nginx/conf.d/mcp-gateway.conf" "$NGINX_SERVERS_DIR/"
    echo "Linked: $NGINX_SERVERS_DIR/mcp-gateway.conf"
fi

# Test nginx config
echo ""
echo "Testing NGINX configuration..."
if nginx -t 2>/dev/null; then
    echo "NGINX config: OK"
else
    echo ""
    echo "NGINX config test failed. You may need to:"
    echo "1. Add 'load_module /opt/homebrew/lib/nginx/modules/ngx_http_js_module.so;' to nginx.conf"
    echo "2. Add 'include servers/*.conf;' to the http block in nginx.conf"
    echo ""
    echo "See docs for manual setup instructions."
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Start backend:  bun run examples/backend-service.ts"
echo "  2. Start nginx:    nginx (or: brew services start nginx-full)"
echo "  3. Initialize:     curl -X POST http://localhost:3000/init"
echo "  4. Test:           ./scripts/test-mcp.sh"
