/**
 * Call Function (Admin)
 *
 * Directly call a function without going through an agent.
 */

import { callBridgeTool } from "./lib/config";

interface CallFunctionParams {
  function_name: string;
  arguments?: Record<string, unknown>;
}

export default async function (params: Record<string, unknown>) {
  const { function_name, arguments: args } = params as CallFunctionParams;

  if (!function_name) {
    throw new Error("Missing required parameter: function_name");
  }

  try {
    const result = await callBridgeTool("admin_call_function", {
      function_name,
      arguments: args || {},
    });
    return result;
  } catch (error) {
    console.error("[orchestrator/admin/call_function] Error:", error);
    throw error;
  }
}
