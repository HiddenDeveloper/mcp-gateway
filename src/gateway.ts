/**
 * MCP Gateway - Bun-based
 *
 * Exposes service_cards via MCP for discovery.
 * Routes HTTP requests to user-defined functions.
 */

import { loadConfig, loadDashboardConfig, type GatewayConfig } from "./config";
import { createMCPHandler } from "./mcp";
import { createRouter } from "./router";
import { createDashboard } from "./dashboard";
import * as dashboardHandlers from "../services/dashboard";

const CONFIG_PATH = process.env.MCP_CONFIG_PATH || "./config/gateway.json";
const DASHBOARD_CONFIG_PATH = process.env.DASHBOARD_CONFIG_PATH ||
  "/Users/monyet/develop/home/ProjectStoneMonkey/config/dashboard.json";
const PORT = parseInt(process.env.MCP_PORT || "3000");

async function main() {
  console.log("Loading config from", CONFIG_PATH);
  const config = await loadConfig(CONFIG_PATH);

  // Load dashboard config
  console.log("Loading dashboard config from", DASHBOARD_CONFIG_PATH);
  let dashboard;
  try {
    const dashboardConfig = await loadDashboardConfig(DASHBOARD_CONFIG_PATH);
    dashboard = await createDashboard(dashboardConfig, `http://localhost:${PORT}`);
    console.log(`  Dashboard: ${dashboardConfig.dashboard.info.title}`);
  } catch (error) {
    console.warn("Dashboard config not found or invalid, using fallback");
    dashboard = null;
  }

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

      // Dashboard API routes
      if (url.pathname.startsWith("/api/dashboard/")) {
        try {
          const path = url.pathname.replace("/api/dashboard/", "");

          switch (path) {
            case "health":
              const healthData = await dashboardHandlers.getHealth({});
              return Response.json(healthData, {
                headers: { "Access-Control-Allow-Origin": "*" }
              });

            case "consciousness":
              const consciousnessData = await dashboardHandlers.getConsciousness({});
              return Response.json(consciousnessData, {
                headers: { "Access-Control-Allow-Origin": "*" }
              });

            case "pm2":
              const pm2Data = await dashboardHandlers.getPM2Status({});
              return Response.json(pm2Data, {
                headers: { "Access-Control-Allow-Origin": "*" }
              });

            case "autonomous-loop":
              const loopData = await dashboardHandlers.getAutonomousLoop({});
              return Response.json(loopData, {
                headers: { "Access-Control-Allow-Origin": "*" }
              });

            case "mesh":
              const meshData = await dashboardHandlers.getMeshActivity({});
              return Response.json(meshData, {
                headers: { "Access-Control-Allow-Origin": "*" }
              });

            case "research-metrics":
              const metricsData = await dashboardHandlers.getResearchMetrics({});
              return Response.json(metricsData, {
                headers: { "Access-Control-Allow-Origin": "*" }
              });

            default:
              return Response.json(
                { error: "Dashboard endpoint not found" },
                { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
              );
          }
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
          );
        }
      }

      // Serve dashboard at root
      if (url.pathname === "/") {
        if (dashboard) {
          return new Response(dashboard.html, {
            headers: { "Content-Type": "text/html" },
          });
        } else {
          // Fallback to static file
          const file = Bun.file("./public/index.html");
          if (await file.exists()) {
            return new Response(file, {
              headers: { "Content-Type": "text/html" },
            });
          }
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
  if (dashboard) {
    console.log(`  Dashboard: http://localhost:${server.port}/`);
  }
}

main().catch(console.error);
