/**
 * Unregister MCP Server (Admin)
 *
 * In the standalone gateway, services are defined in the config file.
 * Dynamic unregistration is not supported - update gateway.json instead.
 */

interface UnregisterMCPParams {
  name: string;
}

export default async function (params: Record<string, unknown>) {
  const { name } = params as UnregisterMCPParams;

  if (!name) {
    throw new Error("Missing required parameter: name");
  }

  // In the standalone gateway, services are defined in config
  return {
    status: "not_supported",
    message: "Dynamic MCP server unregistration is not supported in standalone mode. Remove services from config/gateway.json instead.",
    suggestion: {
      file: "config/gateway.json",
      action: "Remove the service entry from the 'services' array",
    },
  };
}
