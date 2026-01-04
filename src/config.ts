/**
 * Gateway configuration loader and types
 */

export interface ServerConfig {
  url: string;
  description?: string;
}

export interface ServiceCard {
  operationId: string;
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
  services: ServiceConfig[];
}

export async function loadConfig(path: string): Promise<GatewayConfig> {
  const file = Bun.file(path);
  const exists = await file.exists();

  if (!exists) {
    throw new Error(`Config file not found: ${path}`);
  }

  const content = await file.text();
  const config = JSON.parse(content) as GatewayConfig;

  // Basic validation
  if (!config.gateway?.info?.title) {
    throw new Error("Missing gateway.info.title in config");
  }
  if (!config.gateway?.service_card?.operationId) {
    throw new Error("Missing gateway.service_card.operationId in config");
  }
  if (!Array.isArray(config.services)) {
    throw new Error("Missing services array in config");
  }

  return config;
}
