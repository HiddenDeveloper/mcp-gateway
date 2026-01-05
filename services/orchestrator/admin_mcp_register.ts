/**
 * Register MCP Server (Admin)
 *
 * In the standalone gateway, services are defined in the config file.
 * Dynamic registration is not supported - update gateway.json instead.
 */

interface RegisterMCPParams {
  name: string;
  url: string;
  bearer_token?: string;
  transport?: "sse" | "streamablehttp";
}

export default async function (params: Record<string, unknown>) {
  const { name, url } = params as RegisterMCPParams;

  if (!name) {
    throw new Error("Missing required parameter: name");
  }
  if (!url) {
    throw new Error("Missing required parameter: url");
  }

  // In the standalone gateway, services are defined in config
  return {
    status: "not_supported",
    message: "Dynamic MCP server registration is not supported in standalone mode. Add services to config/gateway.json instead.",
    suggestion: {
      file: "config/gateway.json",
      action: "Add a new service entry to the 'services' array",
    },
  };
}
