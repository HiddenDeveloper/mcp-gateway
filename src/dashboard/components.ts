/**
 * Dashboard Component Renderers
 *
 * Generic component rendering functions that work with any data structure
 * based on configuration.
 */

import type { ComponentConfig, ComponentItem } from "../config";

/**
 * Extract value from object using JSONPath-like syntax
 * Example: "$.gateway.status" from { gateway: { status: "healthy" } }
 */
export function extractValue(data: any, path: string): any {
  if (!path || !path.startsWith("$.")) {
    return undefined;
  }

  const parts = path.substring(2).split(".");
  let current = data;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Format a value based on format type
 */
export function formatValue(value: any, format: string): string {
  if (value === null || value === undefined) {
    return "-";
  }

  switch (format) {
    case "number":
      return typeof value === "number" ? value.toLocaleString() : String(value);

    case "duration":
      if (typeof value === "number") {
        const days = Math.floor(value / 86400);
        const hours = Math.floor((value % 86400) / 3600);
        const minutes = Math.floor((value % 3600) / 60);
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
      }
      return String(value);

    case "time-ago":
      if (typeof value === "string") {
        const date = new Date(value);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours < 1) return "< 1h ago";
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
      }
      return String(value);

    case "countdown":
      if (typeof value === "string") {
        const target = new Date(value);
        const now = new Date();
        const diffMs = target.getTime() - now.getTime();
        if (diffMs < 0) return "Overdue";
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        if (diffMinutes < 60) return `${diffMinutes}m`;
        const diffHours = Math.floor(diffMinutes / 60);
        return `${diffHours}h ${diffMinutes % 60}m`;
      }
      return String(value);

    case "percentage":
      if (typeof value === "number") {
        return `${(value * 100).toFixed(1)}%`;
      }
      return String(value);

    case "status-icon":
      if (value === "healthy" || value === "connected" || value === "online") {
        return "✓";
      }
      if (value === "degraded" || value === "warning") {
        return "⚠";
      }
      if (value === "unhealthy" || value === "offline" || value === "error") {
        return "✗";
      }
      return String(value);

    case "badge":
      return `<span class="badge">${value}</span>`;

    case "list":
      if (Array.isArray(value)) {
        return `<ul>${value.map(v => `<li>${v}</li>`).join("")}</ul>`;
      }
      return String(value);

    case "list-limited":
      if (Array.isArray(value)) {
        const items = value.slice(0, 3);
        return `<ul>${items.map(v => `<li>${v}</li>`).join("")}</ul>`;
      }
      return String(value);

    case "tag-list":
      if (Array.isArray(value)) {
        return value.map(v => `<span class="tag">${v}</span>`).join(" ");
      }
      return String(value);

    case "agent-list":
      if (Array.isArray(value)) {
        return value.map(v => {
          const name = v.agent_id || v;
          return `<div class="agent">${name}</div>`;
        }).join("");
      }
      return String(value);

    case "days":
      return `${value} days`;

    case "text":
    default:
      return String(value);
  }
}

/**
 * Render a status indicator component
 */
export function renderStatusIndicator(component: ComponentConfig, data: any): string {
  const value = extractValue(data, component.value_path || "");
  const formatted = formatValue(value, component.format || "text");
  const label = component.label || "";

  return `
    <div class="status-indicator">
      <span class="label">${label}:</span>
      <span class="value status-${value}">${formatted}</span>
    </div>
  `;
}

/**
 * Render a metric display component
 */
export function renderMetricDisplay(component: ComponentConfig, data: any): string {
  const value = extractValue(data, component.value_path || "");
  const formatted = formatValue(value, component.format || "text");
  const label = component.label || "";

  return `
    <div class="metric-display">
      <span class="label">${label}:</span>
      <span class="value">${formatted}</span>
    </div>
  `;
}

/**
 * Render a card component with multiple items
 */
export function renderCard(component: ComponentConfig, data: any): string {
  const title = component.title || "";
  const items = component.items || [];

  const itemsHtml = items.map(item => {
    const value = extractValue(data, item.value_path);
    const formatted = formatValue(value, item.format);

    return `
      <div class="card-item">
        <span class="item-label">${item.label}:</span>
        <span class="item-value">${formatted}</span>
      </div>
    `;
  }).join("");

  return `
    <div class="card">
      <div class="card-title">${title}</div>
      <div class="card-content">
        ${itemsHtml}
      </div>
    </div>
  `;
}

/**
 * Render a process table component
 */
export function renderProcessTable(component: ComponentConfig, data: any): string {
  const title = component.title || "";
  const columns = component.columns || [];
  const processes = data?.processes || [];

  const headerHtml = columns.map(col => `<th>${col}</th>`).join("");

  const rowsHtml = processes.map((process: any) => {
    const cellsHtml = columns.map(col => {
      let value = process[col];

      // Format specific columns
      if (col === "status") {
        const statusClass = value === "online" ? "status-healthy" : "status-error";
        value = `<span class="${statusClass}">${value}</span>`;
      } else if (col === "uptime" && typeof value === "number") {
        value = formatValue(value, "duration");
      } else if (col === "memory") {
        value = typeof value === "number" ? `${value.toFixed(1)}MB` : value;
      } else if (col === "cpu") {
        value = typeof value === "number" ? `${value.toFixed(1)}%` : value;
      }

      return `<td>${value}</td>`;
    }).join("");

    return `<tr>${cellsHtml}</tr>`;
  }).join("");

  return `
    <div class="table-container">
      <div class="table-title">${title}</div>
      <table class="process-table">
        <thead>
          <tr>${headerHtml}</tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Render a live log component (placeholder for SSE streaming)
 */
export function renderLiveLog(component: ComponentConfig): string {
  const title = component.title || "Live Log";
  const maxEntries = component.max_entries || 500;

  return `
    <div class="live-log">
      <div class="log-header">
        <span class="log-title">${title}</span>
        <div class="log-controls">
          <button id="log-clear" class="log-btn">Clear</button>
          <button id="log-pause" class="log-btn">Pause</button>
          <button id="log-export" class="log-btn">Export</button>
        </div>
      </div>
      <div id="log-entries" class="log-entries" data-max="${maxEntries}">
        <!-- Log entries will be inserted here via JavaScript -->
      </div>
    </div>
  `;
}

/**
 * Generic component renderer - dispatches to specific renderers
 */
export function renderComponent(component: ComponentConfig, data: any): string {
  switch (component.type) {
    case "status-indicator":
      return renderStatusIndicator(component, data);
    case "metric-display":
      return renderMetricDisplay(component, data);
    case "card":
      return renderCard(component, data);
    case "process-table":
      return renderProcessTable(component, data);
    case "live-log":
      return renderLiveLog(component);
    default:
      return `<div class="error">Unknown component type: ${component.type}</div>`;
  }
}
