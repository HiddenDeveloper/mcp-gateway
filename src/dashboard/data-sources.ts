/**
 * Data Source Abstraction
 *
 * Provides unified interface for different data source types:
 * - HTTP: Fetch data via REST endpoints
 * - SSE: Server-Sent Events for streaming data
 * - WebSocket: Bidirectional real-time data
 */

import type { DataSourceConfig } from "../config";

export interface DataSource {
  type: "http" | "sse" | "websocket";
  config: DataSourceConfig;
  fetch(): Promise<any>;
  subscribe?(callback: (data: any) => void): () => void;
}

class HTTPDataSource implements DataSource {
  type = "http" as const;
  config: DataSourceConfig;
  private baseUrl: string;

  constructor(config: DataSourceConfig, baseUrl: string) {
    this.config = config;
    this.baseUrl = baseUrl;
  }

  async fetch(): Promise<any> {
    const url = `${this.baseUrl}${this.config.endpoint}`;
    const method = this.config.method || "GET";

    try {
      const response = await fetch(url, { method });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching from ${url}:`, error);
      throw error;
    }
  }
}

class SSEDataSource implements DataSource {
  type = "sse" as const;
  config: DataSourceConfig;
  private baseUrl: string;

  constructor(config: DataSourceConfig, baseUrl: string) {
    this.config = config;
    this.baseUrl = baseUrl;
  }

  async fetch(): Promise<any> {
    throw new Error("SSE data sources do not support fetch(). Use subscribe() instead.");
  }

  subscribe(callback: (data: any) => void): () => void {
    const url = `${this.baseUrl}${this.config.endpoint}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callback(data);
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
    };

    // Return unsubscribe function
    return () => {
      eventSource.close();
    };
  }
}

class WebSocketDataSource implements DataSource {
  type = "websocket" as const;
  config: DataSourceConfig;
  private baseUrl: string;

  constructor(config: DataSourceConfig, baseUrl: string) {
    this.config = config;
    this.baseUrl = baseUrl;
  }

  async fetch(): Promise<any> {
    throw new Error("WebSocket data sources do not support fetch(). Use subscribe() instead.");
  }

  subscribe(callback: (data: any) => void): () => void {
    const url = this.config.endpoint.replace(/^http/, "ws");
    const ws = new WebSocket(url);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callback(data);
      } catch (error) {
        console.error("Error parsing WebSocket data:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket connection error:", error);
    };

    // Return unsubscribe function
    return () => {
      ws.close();
    };
  }
}

/**
 * Create data sources from configuration
 */
export function createDataSources(
  configs: Record<string, DataSourceConfig>,
  baseUrl: string = ""
): Record<string, DataSource> {
  const sources: Record<string, DataSource> = {};

  for (const [id, config] of Object.entries(configs)) {
    switch (config.type) {
      case "http":
        sources[id] = new HTTPDataSource(config, baseUrl);
        break;
      case "sse":
        sources[id] = new SSEDataSource(config, baseUrl);
        break;
      case "websocket":
        sources[id] = new WebSocketDataSource(config, baseUrl);
        break;
      default:
        throw new Error(`Unknown data source type: ${(config as any).type}`);
    }
  }

  return sources;
}

/**
 * Fetch data from multiple sources in parallel
 */
export async function fetchAllData(
  sources: Record<string, DataSource>
): Promise<Record<string, any>> {
  const data: Record<string, any> = {};
  const fetchPromises: Promise<void>[] = [];

  for (const [id, source] of Object.entries(sources)) {
    if (source.type === "http") {
      fetchPromises.push(
        source.fetch()
          .then(result => { data[id] = result; })
          .catch(error => {
            console.error(`Error fetching ${id}:`, error);
            data[id] = { error: error.message };
          })
      );
    }
  }

  await Promise.all(fetchPromises);
  return data;
}
