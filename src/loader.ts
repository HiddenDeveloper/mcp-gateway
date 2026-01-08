/**
 * Service Loader
 *
 * Loads service implementations from the services/ directory.
 * Services are organized by: services/{serviceId}/{operationId}.ts
 */

import { join } from "path";

export type ServiceHandler = (params: Record<string, unknown>) => Promise<unknown>;

const SERVICES_DIR = process.env.MCP_SERVICES_DIR || "./services";

// Cache loaded services
const serviceCache = new Map<string, ServiceHandler>();

export async function loadFunction(
  serviceId: string,
  operationId: string
): Promise<ServiceHandler> {
  const cacheKey = `${serviceId}/${operationId}`;

  // Check cache
  if (serviceCache.has(cacheKey)) {
    return serviceCache.get(cacheKey)!;
  }

  // Basic security: prevent path traversal
  if (serviceId.includes("..") || serviceId.includes("/") || 
      operationId.includes("..") || operationId.includes("/")) {
    console.warn(`  Warning: Invalid serviceId or operationId: ${cacheKey}`);
    return createStubHandler(serviceId, operationId);
  }

  // Try to load the service
  const servicePath = join(process.cwd(), SERVICES_DIR, serviceId, `${operationId}.ts`);
  const file = Bun.file(servicePath);

  if (await file.exists()) {
    try {
      const module = await import(servicePath);
      const handler = module.default as ServiceHandler;

      if (typeof handler !== "function") {
        console.warn(`  Warning: ${cacheKey} does not export a default function`);
        return createStubHandler(serviceId, operationId);
      }

      serviceCache.set(cacheKey, handler);
      return handler;
    } catch (error) {
      console.warn(`  Warning: Failed to load ${cacheKey}:`, error);
      return createStubHandler(serviceId, operationId);
    }
  }

  // Service file doesn't exist - create a stub
  console.warn(`  Warning: No service found at ${servicePath}`);
  return createStubHandler(serviceId, operationId);
}

function createStubHandler(serviceId: string, operationId: string): ServiceHandler {
  return async (params) => ({
    stub: true,
    message: `Service ${serviceId}/${operationId} not implemented`,
    receivedParams: params,
  });
}

/**
 * Clear the service cache (useful for hot reload)
 */
export function clearServiceCache(): void {
  serviceCache.clear();
}
