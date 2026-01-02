#!/bin/bash
set -e

echo "=== NGINX MCP Gateway - macOS Installation ==="
echo ""

# Check for Homebrew
if ! command -v brew &> /dev/null; then
    echo "ERROR: Homebrew not found. Install from https://brew.sh"
    exit 1
fi

# Tap the nginx community repository
echo "Adding nginx tap..."
brew tap denji/nginx

# Check for stock nginx and warn
if brew list nginx &>/dev/null 2>&1; then
    echo ""
    echo "WARNING: Stock nginx is installed. It conflicts with nginx-full."
    echo "Run: brew uninstall nginx"
    echo "Then re-run this script."
    exit 1
fi

# Install nginx-full with njs module
echo ""
echo "Installing nginx-full with njs support..."
echo "(This may take a few minutes to compile)"
echo ""
brew install nginx-full --with-njs

# Verify installation
echo ""
echo "Verifying njs module..."
if nginx -V 2>&1 | grep -q "njs"; then
    echo "SUCCESS: njs module installed"
else
    echo "WARNING: njs module not found in nginx build"
    echo "You may need to compile manually. See docs/MACOS-SETUP.md"
fi

# Show nginx paths
echo ""
echo "=== NGINX Paths ==="
echo "Binary: $(which nginx)"
echo "Config: /opt/homebrew/etc/nginx/nginx.conf"
echo "Modules: /opt/homebrew/lib/nginx/modules/"
echo "Logs: /opt/homebrew/var/log/nginx/"
echo "Servers: /opt/homebrew/etc/nginx/servers/"

# Check for Bun
echo ""
if ! command -v bun &> /dev/null; then
    echo "Bun not found. Installing..."
    curl -fsSL https://bun.sh/install | bash
    echo "Restart your terminal or run: source ~/.bashrc"
else
    echo "Bun: $(bun --version)"
fi

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Next steps:"
echo "  1. Run: ./scripts/setup.sh"
echo "  2. Start backend: bun run examples/backend-service.ts"
echo "  3. Start nginx: brew services start nginx-full"
echo "  4. Test: ./scripts/test-mcp.sh"
