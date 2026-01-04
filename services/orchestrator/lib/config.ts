/**
 * Orchestrator Service Configuration
 *
 * Standalone configuration for agent discovery and orchestration.
 * Loads agent configurations from external JSON file.
 */

import { resolve } from "path";
import { homedir } from "os";

// ============================================================================
// Configuration
// ============================================================================

// Path to agents.json - can reference ProjectStoneMonkey or local file
const rawAgentsPath = process.env.AGENTS_CONFIG_PATH ||
  "~/develop/home/ProjectStoneMonkey/packages/server/agents.json";

// Expand ~ to home directory
export const AGENTS_CONFIG_PATH = rawAgentsPath.startsWith("~")
  ? resolve(homedir(), rawAgentsPath.slice(2))
  : resolve(rawAgentsPath);

// Gateway URL for internal tool routing
export const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:3000";

// Cache TTL for agent configuration (10 minutes)
export const AGENT_CACHE_TTL = 10 * 60 * 1000;

// ============================================================================
// Re-export types for convenience
// ============================================================================

export * from "./types";
