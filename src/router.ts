/**
 * HTTP Router
 *
 * Routes incoming HTTP requests to user-defined services.
 * Services are loaded from the services/ directory.
 */

import type { GatewayConfig, OperationConfig, ServiceConfig } from "./config";
import { loadFunction, type ServiceHandler } from "./loader";

interface Route {
  method: string;
  fullPattern: RegExp;
  pathParams: string[];
  serviceId: string;
  service: ServiceConfig;
  operation: OperationConfig;
  handler: ServiceHandler;
}

export async function createRouter(config: GatewayConfig) {
  const routes: Route[] = [];

  // Build routes from config
  for (const [serviceId, service] of Object.entries(config.services)) {
    const paths = service.paths || {};

    for (const [path, pathItem] of Object.entries(paths)) {
      const methods = ["get", "post", "put", "patch", "delete"] as const;

      for (const method of methods) {
        const operation = pathItem[method];
        if (!operation) continue;

        // Load the service handler
        const handler = await loadFunction(serviceId, operation.operationId);

        // Convert path to regex (handle path params like /users/{id})
        const { patternStr, params } = pathToRegex(path);

        // Build full pattern with service prefix
        const fullPattern = new RegExp(`^/${serviceId}${patternStr}$`);

        routes.push({
          method: method.toUpperCase(),
          fullPattern,
          pathParams: params,
          serviceId,
          service,
          operation,
          handler,
        });

        console.log(`  Route: ${method.toUpperCase()} /${serviceId}${path} → ${operation.operationId}`);
      }
    }
  }

  async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method;
    const allowedMethods = new Set<string>();

    // Try to match a route
    for (const route of routes) {
      const match = url.pathname.match(route.fullPattern);
      if (!match) continue;

      allowedMethods.add(route.method);

      if (route.method === method) {
        return executeHandler(req, route, match);
      }
    }

    if (allowedMethods.size > 0) {
      return Response.json(
        {
          error: "Method Not Allowed",
          path: url.pathname,
          allowed: Array.from(allowedMethods).sort(),
        },
        {
          status: 405,
          headers: {
            Allow: Array.from(allowedMethods).sort().join(", "),
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    return Response.json(
      { error: "Not Found", path: url.pathname },
      { status: 404 }
    );
  }

  async function executeHandler(
    req: Request,
    route: Route,
    match: RegExpMatchArray
  ): Promise<Response> {
    try {
      // Extract path parameters
      const pathParams: Record<string, string> = {};
      route.pathParams.forEach((param, index) => {
        pathParams[param] = match[index + 1];
      });

      // Extract query parameters
      const url = new URL(req.url);
      const queryParams: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        queryParams[key] = value;
      });

      // Parse request body if present
      let body: unknown = undefined;
      if (["POST", "PUT", "PATCH"].includes(req.method)) {
        const contentType = req.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          body = await req.json();

          // Detect MCP/JSON-RPC style requests and educate the caller
          if (isMCPStyleRequest(body)) {
            return Response.json({
              error: "MCP_PROTOCOL_MISMATCH",
              message: "This is an HTTP API endpoint, not an MCP tool.",
              explanation: "You appear to be sending an MCP/JSON-RPC request to an HTTP endpoint. " +
                "The service_card MCP tools describe HTTP APIs that should be called directly via HTTP.",
              correct_usage: {
                endpoint: `${url.origin}${url.pathname}`,
                method: route.method,
                content_type: "application/json",
                body_format: "Direct JSON parameters, not JSON-RPC wrapped",
                example: {
                  wrong: { jsonrpc: "2.0", method: "tools/call", params: { name: route.operation.operationId } },
                  right: route.operation.requestBody?.content?.["application/json"]?.schema?.properties
                    ? Object.fromEntries(
                        Object.entries(route.operation.requestBody.content["application/json"].schema.properties)
                          .map(([k, v]: [string, any]) => [k, v.example || `<${v.type}>`])
                      )
                    : { query: "<your query>", limit: 10 }
                }
              },
              hint: "MCP is for discovery (service_card tools). HTTP is for execution (the operations listed in service cards)."
            }, {
              status: 400,
              headers: { "Access-Control-Allow-Origin": "*" }
            });
          }
        }
      }

      // Build params object
      const params = {
        ...queryParams,
        ...pathParams,
        ...(typeof body === "object" && body !== null ? body : {}),
      };

      // Execute handler
      const result = await route.handler(params);

      return Response.json(result, {
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error in ${route.operation.operationId}:`, message);

      return Response.json(
        { error: message },
        { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }
  }

  return { handle, routes };
}

/**
 * Convert OpenAPI-style path to regex pattern string
 * e.g., /users/{id}/posts → /users/([^/]+)/posts
 */
function pathToRegex(path: string): { patternStr: string; params: string[] } {
  const params: string[] = [];

  const patternStr = path.replace(/\{([^}]+)\}/g, (_, param) => {
    params.push(param);
    return "([^/]+)";
  });

  return { patternStr, params };
}

/**
 * Detect if a request body looks like an MCP/JSON-RPC request
 * This catches cases where an AI tries to call HTTP APIs as MCP tools
 */
function isMCPStyleRequest(body: unknown): boolean {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  const obj = body as Record<string, unknown>;

  // Check for JSON-RPC 2.0 format
  if (obj.jsonrpc === "2.0") {
    return true;
  }

  // Check for MCP-style method calls
  if (typeof obj.method === "string" && obj.method.includes("/")) {
    return true;
  }

  // Check for tools/call structure
  if (obj.method === "tools/call" || obj.method === "tools/list") {
    return true;
  }

  // Check for params.name pattern (MCP tool invocation)
  if (obj.params && typeof obj.params === "object") {
    const params = obj.params as Record<string, unknown>;
    if (typeof params.name === "string" && typeof params.arguments === "object") {
      return true;
    }
  }

  return false;
}
