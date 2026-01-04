/**
 * Chat Status
 *
 * Get the health status of the orchestration system.
 * Returns information about available agents and services.
 */

import { getAgents } from "./lib/agent-loader";
import { getServiceRegistry } from "./lib/service-registry";
import { AGENTS_CONFIG_PATH, GATEWAY_URL } from "./lib/config";

export default async function (_params: Record<string, unknown>) {
  try {
    const agents = await getAgents();
    const services = getServiceRegistry();

    // Count tools across all services
    let totalTools = 0;
    for (const service of services.values()) {
      totalTools += service.tools.length;
    }

    const status = {
      service: "orchestrator",
      healthy: true,
      agents: {
        count: agents.size,
        source: AGENTS_CONFIG_PATH,
      },
      services: {
        count: services.size,
        names: Array.from(services.keys()),
        total_tools: totalTools,
      },
      gateway_url: GATEWAY_URL,
      timestamp: new Date().toISOString(),
    };

    console.log(`[orchestrator/chat_status] Health check: ${agents.size} agents, ${services.size} services`);

    return status;
  } catch (error) {
    console.error("[orchestrator/chat_status] Error:", error);
    return {
      service: "orchestrator",
      healthy: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };
  }
}
