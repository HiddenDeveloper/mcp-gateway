/**
 * List Functions (Admin)
 *
 * List all available gateway tools across all services.
 *
 * Standalone implementation - uses the local service registry.
 */

import { getServiceRegistry } from "./lib/service-registry";

export default async function (_params: Record<string, unknown>) {
  try {
    const registry = getServiceRegistry();
    const functions = [];

    for (const [serviceName, config] of registry) {
      for (const tool of config.tools) {
        functions.push({
          name: `${serviceName}_${tool.name}`,
          service: serviceName,
          method: tool.method,
          endpoint: `${config.baseUrl}${tool.endpoint}`,
          description: tool.description,
          inputSchema: tool.inputSchema,
        });
      }
    }

    return {
      functions,
      count: functions.length,
    };
  } catch (error) {
    console.error("[orchestrator/admin/functions_list] Error:", error);
    throw error;
  }
}
