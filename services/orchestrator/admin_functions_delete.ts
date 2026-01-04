/**
 * Delete Function
 *
 * Remove a function from the registry.
 */

import { callBridgeTool } from "./lib/config";

interface DeleteFunctionParams {
  function_name: string;
}

export default async function (params: Record<string, unknown>) {
  const { function_name } = params as DeleteFunctionParams;

  if (!function_name) {
    throw new Error("Missing required parameter: function_name");
  }

  try {
    const result = await callBridgeTool("admin_delete_function", { function_name });
    return result;
  } catch (error) {
    console.error("[orchestrator/admin/functions_delete] Error:", error);
    throw error;
  }
}
