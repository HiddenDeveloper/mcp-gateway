/**
 * MCP Gateway - Bun-based
 *
 * Exposes service_cards via MCP for discovery.
 * Routes HTTP requests to user-defined functions.
 */

import { loadConfig, type GatewayConfig } from "./config";
import { createMCPHandler } from "./mcp";
import { createRouter } from "./router";

const CONFIG_PATH = process.env.MCP_CONFIG_PATH || "./config/gateway.json";
const PORT = parseInt(process.env.MCP_PORT || "3000");

async function main() {
  console.log("Loading config from", CONFIG_PATH);
  const config = await loadConfig(CONFIG_PATH);

  const mcpHandler = createMCPHandler(config);
  const router = await createRouter(config);

  const server = Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);

      if (req.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      }

      // Health check
      if (url.pathname === "/health") {
        return Response.json({ status: "healthy" });
      }

      // Serve static files from public/
      if (url.pathname === "/") {
        const file = Bun.file("./public/index.html");
        if (await file.exists()) {
          return new Response(file, {
            headers: { "Content-Type": "text/html" },
          });
        }
      }

      // MCP endpoint
      if (url.pathname === "/mcp") {
        if (req.method === "GET") {
          return mcpHandler.handleGet(req);
        }
        if (req.method === "POST") {
          return mcpHandler.handlePost(req);
        }
      }

      // Route to functions
      return router.handle(req);
    },
  });

  console.log(`MCP Gateway running on http://localhost:${server.port}`);
  console.log(`  Services: ${Object.keys(config.services).length}`);
  console.log(`  MCP endpoint: http://localhost:${server.port}/mcp`);
}

main().catch(console.error);
