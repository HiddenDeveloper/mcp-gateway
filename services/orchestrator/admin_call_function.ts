/**
 * Call Function (Admin)
 *
 * Directly call a gateway tool without going through an agent.
 *
 * Standalone implementation - routes to gateway services.
 */

import { callGatewayTool } from "./lib/config";

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
    const result = await callGatewayTool(function_name, args || {});

    return {
      function_name,
      result,
    };
  } catch (error) {
    console.error("[orchestrator/admin/call_function] Error:", error);
    throw error;
  }
}
