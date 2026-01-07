/**
 * Gateway configuration loader and types
 */

export interface ServerConfig {
  url: string;
  description?: string;
}

export interface ServiceCard {
  summary: string;
  description?: string;
}

export interface ParameterConfig {
  name: string;
  in: "query" | "path" | "header";
  description?: string;
  required?: boolean;
  schema?: SchemaConfig;
}

export interface SchemaConfig {
  type: string;
  description?: string;
  default?: unknown;
  example?: unknown;
  examples?: unknown[];
  enum?: unknown[];
  properties?: Record<string, SchemaConfig>;
  required?: string[];
  items?: SchemaConfig;
}

export interface RequestBodyConfig {
  description?: string;
  required?: boolean;
  content?: {
    "application/json"?: {
      schema?: SchemaConfig;
    };
  };
}

export interface OperationConfig {
  operationId: string;
  summary: string;
  description?: string;
  parameters?: ParameterConfig[];
  requestBody?: RequestBodyConfig;
}

export interface PathItemConfig {
  get?: OperationConfig;
  post?: OperationConfig;
  put?: OperationConfig;
  patch?: OperationConfig;
  delete?: OperationConfig;
}

export interface ServiceConfig {
  servers: ServerConfig[];
  service_card: ServiceCard;
  paths?: Record<string, PathItemConfig>;
}

export interface GatewayInfo {
  title: string;
  version: string;
  description?: string;
}

export interface GatewayConfig {
  gateway: {
    info: GatewayInfo;
    service_card: ServiceCard;
  };
  services: Record<string, ServiceConfig>;
}

interface RawGatewayConfig {
  gateway: {
    info: GatewayInfo;
    service_card: ServiceCard;
  };
  services: Record<string, ServiceConfig | string>;
}

export async function loadConfig(path: string): Promise<GatewayConfig> {
  const file = Bun.file(path);
  const exists = await file.exists();

  if (!exists) {
    throw new Error(`Config file not found: ${path}`);
  }

  const content = await file.text();
  const rawConfig = JSON.parse(content) as RawGatewayConfig;

  // Basic validation
  if (!rawConfig.gateway?.info?.title) {
    throw new Error("Missing gateway.info.title in config");
  }
  if (!rawConfig.gateway?.service_card?.summary) {
    throw new Error("Missing gateway.service_card.summary in config");
  }
  if (!rawConfig.services || typeof rawConfig.services !== "object") {
    throw new Error("Missing services object in config");
  }

  const services: Record<string, ServiceConfig> = {};
  const configDir = path.substring(0, path.lastIndexOf("/"));

  for (const [serviceId, rawService] of Object.entries(rawConfig.services)) {
    let service: ServiceConfig;

    if (typeof rawService === "string") {
      // Load service config from referenced file
      const servicePath = rawService.startsWith(".") 
        ? `${configDir}/${rawService}` 
        : rawService;
      
      const serviceFile = Bun.file(servicePath);
      if (!(await serviceFile.exists())) {
        throw new Error(`Service config file not found: ${servicePath} (referenced by ${serviceId})`);
      }
      service = await serviceFile.json();
    } else {
      service = rawService;
    }

    // Validate service config
    if (!Array.isArray(service.servers) || service.servers.length === 0) {
      throw new Error(`Service "${serviceId}" is missing servers`);
    }
    if (!service.service_card?.summary) {
      throw new Error(`Service "${serviceId}" is missing service_card.summary`);
    }
    if (!service.paths || typeof service.paths !== "object") {
      throw new Error(`Service "${serviceId}" is missing paths`);
    }

    for (const [path, pathItem] of Object.entries(service.paths)) {
      const operations = pathItem as Record<string, OperationConfig | undefined>;
      for (const [method, operation] of Object.entries(operations)) {
        if (!operation) continue;
        if (!operation.operationId) {
          throw new Error(`Service "${serviceId}" path "${path}" ${method} is missing operationId`);
        }
        if (!operation.summary) {
          throw new Error(`Service "${serviceId}" path "${path}" ${method} is missing summary`);
        }
      }
    }
    
    services[serviceId] = service;
  }

  return {
    ...rawConfig,
    services
  };
}
