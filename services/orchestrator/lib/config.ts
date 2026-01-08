/**
 * Orchestrator Service Configuration
 *
 * Standalone configuration for agent discovery and orchestration.
 * Completely decoupled from ProjectStoneMonkey - uses local config.
 */

import { resolve, dirname } from "path";
import { homedir } from "os";
import { getService } from "./service-registry";

// ============================================================================
// Configuration
// ============================================================================

// Path to agents.json - defaults to local config directory
const rawAgentsPath = process.env.AGENTS_CONFIG_PATH ||
  "./config/agents.json";

// Expand ~ to home directory
export const AGENTS_CONFIG_PATH = rawAgentsPath.startsWith("~")
  ? resolve(homedir(), rawAgentsPath.slice(2))
  : resolve(rawAgentsPath);

// Path to protocols directory
const rawProtocolsPath = process.env.PROTOCOLS_PATH || "./config/protocols";
export const PROTOCOLS_PATH = rawProtocolsPath.startsWith("~")
  ? resolve(homedir(), rawProtocolsPath.slice(2))
  : resolve(rawProtocolsPath);

// Gateway URL for internal tool routing
export const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:3000";

// Ailumina Server URL for WebSocket chat
export const AILUMINA_SERVER_URL = process.env.AILUMINA_SERVER_URL || "ws://localhost:8000";

// Cache TTL for agent configuration (10 minutes)
export const AGENT_CACHE_TTL = 10 * 60 * 1000;

// ============================================================================
// Gateway Tool Caller
// ============================================================================

/**
 * Call a gateway service tool by name
 *
 * Tool names follow the pattern: service_toolname
 * Examples: memory_semantic_search, mesh_broadcast, recall_text_search
 */
export async function callGatewayTool(
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  // Parse tool name (format: service_toolname)
  const parts = toolName.split("_");
  if (parts.length < 2) {
    throw new Error(`Invalid tool name format: ${toolName}. Expected: service_toolname`);
  }

  const serviceName = parts[0];
  const actualToolName = parts.slice(1).join("_");

  // Get service configuration
  const service = getService(serviceName);
  if (!service) {
    throw new Error(`Unknown service: ${serviceName}. Available: memory, mesh, recall, orchestrator`);
  }

  // Find tool in service
  const tool = service.tools.find(t => t.name === actualToolName);
  if (!tool) {
    throw new Error(`Tool not found: ${actualToolName} in service ${serviceName}`);
  }

  // Build endpoint URL
  let endpoint = `${GATEWAY_URL}${service.baseUrl}${tool.endpoint}`;

  // Handle path parameters (e.g., /thread/{messageId})
  if (tool.endpoint.includes("{") && args) {
    for (const [key, value] of Object.entries(args)) {
      endpoint = endpoint.replace(`{${key}}`, String(value));
    }
  }

  // Build query params for GET requests
  if (tool.method === "GET" && Object.keys(args).length > 0) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    }
    endpoint = `${endpoint}?${params.toString()}`;
  }

  console.log(`[callGatewayTool] ${tool.method} ${endpoint}`);

  // Make the request
  const response = await fetch(endpoint, {
    method: tool.method,
    headers: {
      "Content-Type": "application/json",
    },
    ...(tool.method === "POST" && {
      body: JSON.stringify(args),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gateway call failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

// ============================================================================
// Re-export types for convenience
// ============================================================================

export * from "./types";
