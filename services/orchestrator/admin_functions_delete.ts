/**
 * Delete Function (Admin)
 *
 * In the standalone gateway, functions are defined in the services directory.
 * Dynamic deletion is not supported - remove the service file instead.
 */

interface DeleteFunctionParams {
  function_name: string;
}

export default async function (params: Record<string, unknown>) {
  const { function_name } = params as DeleteFunctionParams;

  if (!function_name) {
    throw new Error("Missing required parameter: function_name");
  }

  // Parse the function name to determine the service and function
  const parts = function_name.split("_");
  const serviceName = parts[0];
  const toolName = parts.slice(1).join("_");

  return {
    status: "not_supported",
    message: "Dynamic function deletion is not supported in standalone mode. Remove the service file instead.",
    suggestion: {
      file: `services/${serviceName}/${toolName}.ts`,
      action: "Delete this file and update config/gateway.json to remove the endpoint",
    },
  };
}
