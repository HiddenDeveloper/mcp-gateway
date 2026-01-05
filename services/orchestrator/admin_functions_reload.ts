/**
 * Reload Functions (Admin)
 *
 * In the standalone gateway, functions are loaded from the services directory.
 * Restart the gateway to reload functions.
 */

import { getServiceRegistry } from "./lib/service-registry";

export default async function (_params: Record<string, unknown>) {
  try {
    // Get current function count from service registry
    const registry = getServiceRegistry();
    let functionCount = 0;
    for (const [, config] of registry) {
      functionCount += config.tools.length;
    }

    return {
      status: "info",
      message: "Functions are loaded from the services directory. Restart the gateway to reload.",
      current_function_count: functionCount,
      suggestion: "Restart the gateway process to reload service implementations",
    };
  } catch (error) {
    console.error("[orchestrator/admin/functions_reload] Error:", error);
    throw error;
  }
}
