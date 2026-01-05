/**
 * List MCP Servers (Admin)
 *
 * List all registered gateway services (MCP servers).
 *
 * Standalone implementation - uses the local service registry.
 */

import { getServiceRegistry } from "./lib/service-registry";

export default async function (_params: Record<string, unknown>) {
  try {
    const registry = getServiceRegistry();
    const servers = [];

    for (const [name, config] of registry) {
      servers.push({
        name,
        baseUrl: config.baseUrl,
        tools_count: config.tools.length,
        tools: config.tools.map(t => ({
          name: `${name}_${t.name}`,
          method: t.method,
          endpoint: t.endpoint,
          description: t.description,
        })),
      });
    }

    return {
      servers,
      count: servers.length,
    };
  } catch (error) {
    console.error("[orchestrator/admin/mcp_list] Error:", error);
    throw error;
  }
}
