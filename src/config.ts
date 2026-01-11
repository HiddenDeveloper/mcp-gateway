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

// ============================================================================
// Dashboard Configuration Types
// ============================================================================

export interface DashboardInfo {
  title: string;
  version: string;
  description?: string;
}

export interface RefreshConfig {
  default_interval_ms: number;
  slow_interval_ms: number;
  fast_interval_ms: number;
}

export interface LayoutSection {
  id: string;
  type: "status-bar" | "card-grid" | "table" | "full-width";
  columns?: number;
  components: string[];
}

export interface ComponentItem {
  label: string;
  value_path: string;
  format: string;
  limit?: number;
}

export interface ComponentConfig {
  type: string;
  title?: string;
  data_source: string;
  refresh_interval: "fast" | "default" | "slow";
  items?: ComponentItem[];
  columns?: string[];
  actions?: string[];
  max_entries?: number;
  filters?: string[];
  label?: string;
  value_path?: string;
  format?: string;
  limit?: number;
}

export interface DataSourceConfig {
  type: "http" | "sse" | "websocket";
  endpoint: string;
  method?: "GET" | "POST";
}

export interface DashboardConfig {
  dashboard: {
    info: DashboardInfo;
    refresh: RefreshConfig;
  };
  layout: {
    sections: LayoutSection[];
  };
  components: Record<string, ComponentConfig>;
  data_sources: Record<string, DataSourceConfig>;
}

/**
 * Load dashboard configuration from a JSON file
 */
export async function loadDashboardConfig(path: string): Promise<DashboardConfig> {
  const file = Bun.file(path);
  const exists = await file.exists();

  if (!exists) {
    throw new Error(`Dashboard config not found: ${path}`);
  }

  const config = await file.json();

  // Validation
  if (!config.dashboard?.info?.title) {
    throw new Error("Missing dashboard.info.title");
  }
  if (!config.dashboard?.refresh) {
    throw new Error("Missing dashboard.refresh");
  }
  if (!config.layout?.sections) {
    throw new Error("Missing layout.sections");
  }
  if (!config.components) {
    throw new Error("Missing components");
  }
  if (!config.data_sources) {
    throw new Error("Missing data_sources");
  }

  // Validate components reference valid data sources
  for (const [componentId, component] of Object.entries(config.components)) {
    if (!config.data_sources[component.data_source]) {
      throw new Error(
        `Component "${componentId}" references unknown data source "${component.data_source}"`
      );
    }
  }

  // Validate layout sections reference valid components
  for (const section of config.layout.sections) {
    for (const componentId of section.components) {
      if (!config.components[componentId]) {
        throw new Error(
          `Layout section "${section.id}" references unknown component "${componentId}"`
        );
      }
    }
  }

  return config as DashboardConfig;
}
