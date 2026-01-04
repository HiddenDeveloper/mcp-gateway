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

    // Try to match a route
    for (const route of routes) {
      if (route.method !== method) continue;

      const match = url.pathname.match(route.fullPattern);
      if (match) {
        return executeHandler(req, route, match);
      }
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
