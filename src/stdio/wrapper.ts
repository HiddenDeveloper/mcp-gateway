#!/usr/bin/env bun
/**
 * STDIO Transport Wrapper for MCP Gateway
 *
 * Bridges STDIO transport (used by Claude Code) to HTTP transport.
 * Reads JSON-RPC lines from stdin, POSTs to the gateway, writes responses to stdout.
 *
 * Usage:
 *   bun run src/stdio/wrapper.ts
 *
 * Or in Claude Code settings:
 *   "mcpServers": {
 *     "my-gateway": {
 *       "command": "bun",
 *       "args": ["run", "/path/to/mcp-gateway/src/stdio/wrapper.ts"]
 *     }
 *   }
 */

const GATEWAY_URL = process.env.MCP_GATEWAY_URL || "http://localhost:3000/mcp";
const DEBUG = process.env.MCP_DEBUG === "true";

function log(...args: unknown[]) {
  if (DEBUG) {
    console.error("[stdio-wrapper]", ...args);
  }
}

async function processLine(line: string): Promise<void> {
  const trimmed = line.trim();
  if (!trimmed) return;

  log("→ Request:", trimmed);

  try {
    // Validate it's JSON before sending
    JSON.parse(trimmed);

    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: trimmed,
    });

    const responseText = await response.text();
    log("← Response:", responseText);

    // Write response to stdout
    console.log(responseText);
  } catch (error) {
    // Send JSON-RPC error response
    const errorResponse = {
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : "Internal error",
      },
      id: null,
    };
    console.log(JSON.stringify(errorResponse));
    log("Error:", error);
  }
}

async function main() {
  log("Starting STDIO wrapper, gateway:", GATEWAY_URL);

  // Use Bun's readline for line-by-line stdin processing
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of Bun.stdin.stream()) {
    buffer += decoder.decode(chunk, { stream: true });

    // Process complete lines
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      await processLine(line);
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    await processLine(buffer);
  }

  log("STDIO wrapper exiting");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
