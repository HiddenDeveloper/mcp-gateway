/**
 * Dashboard Entry Point
 *
 * Main interface for creating and managing dashboards.
 */

import type { DashboardConfig } from "../config";
import { createDataSources, fetchAllData, type DataSource } from "./data-sources";
import { renderDashboard } from "./renderer";

export interface Dashboard {
  config: DashboardConfig;
  dataSources: Record<string, DataSource>;
  html: string;
  render(initialData?: Record<string, any>): string;
  fetchInitialData(): Promise<Record<string, any>>;
}

/**
 * Create a dashboard from configuration
 */
export async function createDashboard(
  config: DashboardConfig,
  baseUrl: string = ""
): Promise<Dashboard> {
  // Create data sources
  const dataSources = createDataSources(config.data_sources, baseUrl);

  // Fetch initial data for HTTP sources
  const initialData = await fetchAllData(dataSources);

  // Render initial HTML
  const html = renderDashboard(config, initialData);

  return {
    config,
    dataSources,
    html,

    /**
     * Re-render dashboard with new data
     */
    render(data?: Record<string, any>): string {
      return renderDashboard(config, data || {});
    },

    /**
     * Fetch fresh data from all HTTP sources
     */
    async fetchInitialData(): Promise<Record<string, any>> {
      return await fetchAllData(dataSources);
    }
  };
}

// Re-export types for convenience
export type { DashboardConfig, DataSource };
export { renderDashboard } from "./renderer";
export { renderComponent } from "./components";
export { createDataSources } from "./data-sources";
