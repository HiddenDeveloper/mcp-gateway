/**
 * Memory Backend Server
 *
 * Simple /execute endpoint server that routes function calls
 * to the appropriate handler functions.
 *
 * Receives: POST /execute { function: "name", arguments: {...} }
 * Returns: { result: ... } or { error: "message" }
 */

import { functions } from "./functions";

const PORT = parseInt(process.env.MEMORY_PORT || "3003");

interface ExecuteRequest {
  function: string;
  arguments: Record<string, unknown>;
}

async function handleExecute(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as ExecuteRequest;

    if (!body.function) {
      return Response.json(
        { error: "Missing function name" },
        { status: 400 }
      );
    }

    const func = functions[body.function];
    if (!func) {
      return Response.json(
        { error: `Unknown function: ${body.function}` },
        { status: 404 }
      );
    }

    console.log(`[memory] Executing: ${body.function}`);
    const startTime = Date.now();

    const result = await func(body.arguments || {});

    const duration = Date.now() - startTime;
    console.log(`[memory] ${body.function} completed in ${duration}ms`);

    return Response.json({ result });
  } catch (error) {
    console.error("[memory] Error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

function handleHealth(): Response {
  return Response.json({
    status: "healthy",
    service: "memory-backend",
    functions: Object.keys(functions),
    timestamp: new Date().toISOString(),
  });
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // CORS for development
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Route requests
    if (req.method === "POST" && url.pathname === "/execute") {
      return handleExecute(req);
    }

    if (req.method === "GET" && url.pathname === "/health") {
      return handleHealth();
    }

    // List available functions
    if (req.method === "GET" && url.pathname === "/functions") {
      return Response.json({
        functions: Object.keys(functions).map((name) => ({
          name,
          // Could add inputSchema here if we enhance the function registry
        })),
      });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
});

console.log(`[memory] Server running on http://localhost:${PORT}`);
console.log(`[memory] Available functions: ${Object.keys(functions).join(", ")}`);
