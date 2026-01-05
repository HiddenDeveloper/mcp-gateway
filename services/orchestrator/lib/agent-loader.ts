/**
 * Agent Configuration Loader
 *
 * Loads agent configurations from JSON file with caching.
 * Compatible with ProjectStoneMonkey agents.json format.
 */

import { readFile, writeFile } from "fs/promises";
import { AGENTS_CONFIG_PATH, AGENT_CACHE_TTL } from "./config";
import { getServiceRegistry } from "./service-registry";
import type { AgentConfig, AgentsConfig, AgentSummary, AgentDetails } from "./types";

// ============================================================================
// Cache
// ============================================================================

let agentCache: Map<string, AgentConfig> | null = null;
let lastLoadTime: number = 0;

// ============================================================================
// Loader Functions
// ============================================================================

/**
 * Load agents from JSON file
 */
async function loadAgentsFromFile(): Promise<Map<string, AgentConfig>> {
  console.log(`[AgentLoader] Loading agents from: ${AGENTS_CONFIG_PATH}`);

  try {
    const content = await readFile(AGENTS_CONFIG_PATH, "utf-8");
    const data = JSON.parse(content) as AgentsConfig;

    const agents = new Map<string, AgentConfig>();

    for (const [key, config] of Object.entries(data)) {
      // Normalize config with backward compatibility
      const normalized: AgentConfig = {
        ...config,
        name: config.agent_name || config.name || key,
        assigned_functions: config.assigned_functions || config.available_functions || [],
        assigned_agents: config.assigned_agents || [],
        assigned_mcp_servers: config.assigned_mcp_servers || config.mcp_servers || [],
        assigned_mcp_tools: config.assigned_mcp_tools || {},
      };
      agents.set(key, normalized);
    }

    console.log(`[AgentLoader] Loaded ${agents.size} agents`);
    return agents;
  } catch (error) {
    console.error("[AgentLoader] Failed to load agents:", error);
    throw new Error(`Failed to load agents: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if cache is stale
 */
function isCacheStale(): boolean {
  if (!agentCache) return true;
  return Date.now() - lastLoadTime > AGENT_CACHE_TTL;
}

/**
 * Get all agents (with caching)
 */
export async function getAgents(): Promise<Map<string, AgentConfig>> {
  if (!isCacheStale() && agentCache) {
    return agentCache;
  }

  agentCache = await loadAgentsFromFile();
  lastLoadTime = Date.now();
  return agentCache;
}

/**
 * Get a specific agent by name/key
 */
export async function getAgent(name: string): Promise<AgentConfig | undefined> {
  const agents = await getAgents();
  return agents.get(name);
}

/**
 * Force reload agents from file
 */
export async function reloadAgents(): Promise<Map<string, AgentConfig>> {
  agentCache = null;
  lastLoadTime = 0;
  return getAgents();
}

// ============================================================================
// Tool Count Calculation
// ============================================================================

/**
 * Calculate MCP tool count for an agent
 */
function calculateMcpToolCount(agent: AgentConfig): number {
  const serviceRegistry = getServiceRegistry();
  let count = 0;

  // Full access servers - count all tools
  for (const serverName of agent.assigned_mcp_servers || []) {
    const service = serviceRegistry.get(serverName);
    if (service) {
      // If specific tools assigned, use that count
      if (agent.assigned_mcp_tools?.[serverName]?.length) {
        count += agent.assigned_mcp_tools[serverName].length;
      } else {
        // Otherwise count all tools in service
        count += service.tools.length;
      }
    }
  }

  // Add granular tools from servers not in full access list
  if (agent.assigned_mcp_tools) {
    for (const [serverName, tools] of Object.entries(agent.assigned_mcp_tools)) {
      if (!agent.assigned_mcp_servers?.includes(serverName)) {
        count += tools.length;
      }
    }
  }

  return count;
}

/**
 * Get all tool names for an agent
 */
export function getAgentToolNames(agent: AgentConfig): string[] {
  const tools: string[] = [];
  const serviceRegistry = getServiceRegistry();

  // Add assigned functions
  for (const fn of agent.assigned_functions || []) {
    tools.push(fn);
  }

  // Add delegation tools
  for (const agentName of agent.assigned_agents || []) {
    tools.push(`delegate_to_${agentName}`);
  }

  // Add MCP tools
  for (const serverName of agent.assigned_mcp_servers || []) {
    const service = serviceRegistry.get(serverName);
    if (service) {
      if (agent.assigned_mcp_tools?.[serverName]?.length) {
        // Specific tools only
        for (const toolName of agent.assigned_mcp_tools[serverName]) {
          tools.push(`${serverName}_${toolName}`);
        }
      } else {
        // All tools from server
        for (const tool of service.tools) {
          tools.push(`${serverName}_${tool.name}`);
        }
      }
    }
  }

  // Add granular tools from servers not in full access list
  if (agent.assigned_mcp_tools) {
    for (const [serverName, toolNames] of Object.entries(agent.assigned_mcp_tools)) {
      if (!agent.assigned_mcp_servers?.includes(serverName)) {
        for (const toolName of toolNames) {
          tools.push(`${serverName}_${toolName}`);
        }
      }
    }
  }

  return tools;
}

// ============================================================================
// Agent Summary/Details Builders
// ============================================================================

/**
 * Build AgentSummary from config
 */
export function buildAgentSummary(key: string, agent: AgentConfig): AgentSummary {
  const functionCount = agent.assigned_functions?.length || 0;
  const agentCount = agent.assigned_agents?.length || 0;
  const mcpToolCount = calculateMcpToolCount(agent);

  return {
    name: agent.name || key,
    description: agent.description || "",
    protocol: agent.protocol || agent.custom_settings?.protocol as string | undefined,
    function_count: functionCount,
    agent_count: agentCount,
    mcp_tool_count: mcpToolCount,
    total_tools: functionCount + agentCount + mcpToolCount,
    mcp_servers: agent.assigned_mcp_servers || [],
  };
}

/**
 * Build AgentDetails from config
 */
export function buildAgentDetails(key: string, agent: AgentConfig): AgentDetails {
  const summary = buildAgentSummary(key, agent);
  const tools = getAgentToolNames(agent);

  return {
    ...summary,
    system_prompt: agent.system_prompt || "",
    assigned_functions: agent.assigned_functions || [],
    assigned_agents: agent.assigned_agents || [],
    assigned_mcp_servers: agent.assigned_mcp_servers || [],
    tools,
  };
}

/**
 * List all agents as summaries
 */
export async function listAgentSummaries(
  mcpServerFilter?: string,
  limit?: number
): Promise<AgentSummary[]> {
  const agents = await getAgents();
  let summaries: AgentSummary[] = [];

  for (const [key, agent] of agents) {
    // Filter by MCP server if specified
    if (mcpServerFilter) {
      const hasServer = agent.assigned_mcp_servers?.includes(mcpServerFilter) ||
        Object.keys(agent.assigned_mcp_tools || {}).includes(mcpServerFilter);
      if (!hasServer) continue;
    }

    summaries.push(buildAgentSummary(key, agent));
  }

  // Sort by total_tools descending
  summaries.sort((a, b) => b.total_tools - a.total_tools);

  // Apply limit
  if (limit && limit > 0) {
    summaries = summaries.slice(0, limit);
  }

  return summaries;
}

// ============================================================================
// Agent CRUD Operations
// ============================================================================

/**
 * Save agents to file
 */
async function saveAgents(agents: Map<string, AgentConfig>): Promise<void> {
  const data: AgentsConfig = {};
  for (const [key, config] of agents) {
    data[key] = config;
  }
  await writeFile(AGENTS_CONFIG_PATH, JSON.stringify(data, null, 2), "utf-8");
  console.log(`[AgentLoader] Saved ${agents.size} agents to: ${AGENTS_CONFIG_PATH}`);
}

/**
 * Create a new agent
 */
export async function createAgent(
  name: string,
  config: Omit<AgentConfig, "name">
): Promise<AgentConfig> {
  const agents = await getAgents();

  if (agents.has(name)) {
    throw new Error(`Agent already exists: ${name}`);
  }

  const newAgent: AgentConfig = {
    ...config,
    name,
    assigned_functions: config.assigned_functions || [],
    assigned_agents: config.assigned_agents || [],
    assigned_mcp_servers: config.assigned_mcp_servers || [],
  };

  agents.set(name, newAgent);
  await saveAgents(agents);

  // Update cache
  agentCache = agents;
  lastLoadTime = Date.now();

  return newAgent;
}

/**
 * Update an existing agent
 */
export async function updateAgent(
  name: string,
  updates: Partial<AgentConfig>
): Promise<AgentConfig> {
  const agents = await getAgents();
  const existing = agents.get(name);

  if (!existing) {
    throw new Error(`Agent not found: ${name}`);
  }

  const updated: AgentConfig = {
    ...existing,
    ...updates,
    name, // Keep original name
  };

  agents.set(name, updated);
  await saveAgents(agents);

  // Update cache
  agentCache = agents;
  lastLoadTime = Date.now();

  return updated;
}

/**
 * Delete an agent
 */
export async function deleteAgent(name: string): Promise<boolean> {
  const agents = await getAgents();

  if (!agents.has(name)) {
    throw new Error(`Agent not found: ${name}`);
  }

  agents.delete(name);
  await saveAgents(agents);

  // Update cache
  agentCache = agents;
  lastLoadTime = Date.now();

  return true;
}
