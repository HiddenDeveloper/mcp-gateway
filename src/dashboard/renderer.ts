/**
 * Dashboard HTML Renderer
 *
 * Generates complete HTML page with embedded CSS and JavaScript
 * for the dashboard based on configuration.
 */

import type { DashboardConfig, LayoutSection } from "../config";
import { renderComponent } from "./components";

/**
 * Generate CSS styles for the dashboard
 */
function generateStyles(): string {
  return `
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
        min-height: 100vh;
        color: #e4e4e7;
        padding: 20px;
      }

      .dashboard {
        max-width: 1400px;
        margin: 0 auto;
      }

      .dashboard-header {
        text-align: center;
        margin-bottom: 30px;
      }

      .dashboard-title {
        font-size: 2.5rem;
        font-weight: 700;
        margin-bottom: 10px;
        background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .dashboard-description {
        font-size: 1rem;
        color: #a1a1aa;
      }

      /* Status Bar */
      .status-bar {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 20px;
        padding: 15px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        margin-bottom: 20px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        transition: all 0.3s ease;
      }

      .status-bar:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(245, 158, 11, 0.2);
      }

      .status-indicator, .metric-display {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .status-indicator .label, .metric-display .label {
        font-weight: 600;
        color: #a1a1aa;
      }

      .status-indicator .value {
        font-weight: 700;
        transition: all 0.3s ease;
      }

      .status-healthy {
        color: #22c55e;
        text-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
      }

      .status-degraded {
        color: #f59e0b;
        animation: pulse 2s ease-in-out infinite;
      }

      .status-error {
        color: #ef4444;
        animation: pulse 2s ease-in-out infinite;
      }

      .status-online {
        color: #22c55e;
        text-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
      }

      .status-offline {
        color: #ef4444;
        animation: pulse 2s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }

      /* Card Grid */
      .card-grid {
        display: grid;
        gap: 20px;
        margin-bottom: 20px;
      }

      .card-grid.columns-2 { grid-template-columns: repeat(2, 1fr); }
      .card-grid.columns-3 { grid-template-columns: repeat(3, 1fr); }

      @media (max-width: 1024px) {
        .card-grid.columns-3 { grid-template-columns: repeat(2, 1fr); }
      }

      @media (max-width: 768px) {
        body {
          padding: 10px;
        }

        .card-grid {
          grid-template-columns: 1fr;
          gap: 15px;
        }

        .dashboard-title {
          font-size: 1.75rem;
        }

        .dashboard-description {
          font-size: 0.875rem;
        }

        .status-bar {
          flex-direction: column;
          gap: 10px;
          padding: 10px;
        }

        .card {
          padding: 15px;
        }

        .card-title, .table-title, .log-title {
          font-size: 1rem;
        }

        .table-container {
          padding: 15px;
        }

        .process-table {
          font-size: 0.875rem;
        }

        .process-table th,
        .process-table td {
          padding: 8px 6px;
        }

        .log-controls {
          flex-wrap: wrap;
          gap: 6px;
        }

        .log-btn {
          font-size: 0.75rem;
          padding: 4px 8px;
        }
      }

      @media (max-width: 480px) {
        .dashboard-title {
          font-size: 1.5rem;
        }

        .card-item {
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }

        .table-container {
          overflow-x: auto;
        }

        .process-table {
          min-width: 600px;
        }
      }

      .card {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 20px;
        backdrop-filter: blur(10px);
        transition: all 0.3s ease;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
        border-color: rgba(245, 158, 11, 0.3);
      }

      .card.updating {
        opacity: 0.7;
      }

      .card-title {
        font-size: 1.2rem;
        font-weight: 700;
        margin-bottom: 15px;
        color: #f59e0b;
      }

      .card-content {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .card-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .card-item:last-child {
        border-bottom: none;
      }

      .item-label {
        font-weight: 600;
        color: #a1a1aa;
      }

      .item-value {
        font-weight: 600;
        color: #e4e4e7;
      }

      /* Table */
      .table-container {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
        overflow-x: auto;
        border: 1px solid rgba(255, 255, 255, 0.1);
        transition: all 0.3s ease;
      }

      .table-container:hover {
        border-color: rgba(245, 158, 11, 0.2);
      }

      .table-title {
        font-size: 1.2rem;
        font-weight: 700;
        margin-bottom: 15px;
        color: #f59e0b;
      }

      .process-table {
        width: 100%;
        border-collapse: collapse;
      }

      .process-table th {
        text-align: left;
        padding: 12px;
        font-weight: 700;
        color: #a1a1aa;
        border-bottom: 2px solid rgba(255, 255, 255, 0.1);
      }

      .process-table td {
        padding: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }

      .process-table tbody tr {
        transition: all 0.2s ease;
      }

      .process-table tbody tr:hover {
        background: rgba(245, 158, 11, 0.1);
        transform: scale(1.01);
      }

      /* Live Log */
      .live-log {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
      }

      .log-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }

      .log-title {
        font-size: 1.2rem;
        font-weight: 700;
        color: #f59e0b;
      }

      .log-controls {
        display: flex;
        gap: 10px;
      }

      .log-btn {
        padding: 6px 12px;
        background: rgba(245, 158, 11, 0.1);
        border: 1px solid #f59e0b;
        border-radius: 6px;
        color: #f59e0b;
        cursor: pointer;
        font-size: 0.875rem;
        transition: all 0.2s;
      }

      .log-btn:hover {
        background: rgba(245, 158, 11, 0.2);
      }

      .log-entries {
        max-height: 400px;
        overflow-y: auto;
        font-family: 'SF Mono', Monaco, 'Courier New', monospace;
        font-size: 0.875rem;
        line-height: 1.6;
      }

      .log-entry {
        padding: 4px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }

      .log-entry .timestamp {
        color: #a1a1aa;
        margin-right: 10px;
      }

      .log-entry .source {
        color: #3b82f6;
        margin-right: 10px;
      }

      .log-entry .message {
        color: #e4e4e7;
      }

      /* Badges and Tags */
      .badge {
        display: inline-block;
        padding: 2px 8px;
        background: rgba(245, 158, 11, 0.2);
        border: 1px solid #f59e0b;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        color: #f59e0b;
      }

      .tag {
        display: inline-block;
        padding: 2px 8px;
        background: rgba(59, 130, 246, 0.2);
        border: 1px solid #3b82f6;
        border-radius: 4px;
        font-size: 0.75rem;
        color: #3b82f6;
        margin-right: 4px;
      }

      .agent {
        padding: 4px 0;
        color: #e4e4e7;
      }

      /* Lists */
      ul {
        list-style: none;
        padding-left: 0;
      }

      ul li {
        padding: 4px 0;
        color: #e4e4e7;
      }

      ul li:before {
        content: "•";
        color: #f59e0b;
        font-weight: bold;
        display: inline-block;
        width: 1em;
        margin-left: -1em;
      }

      /* Loading State */
      .loading {
        text-align: center;
        padding: 40px;
        color: #a1a1aa;
        animation: fadeIn 0.3s ease;
      }

      .loading-spinner {
        display: inline-block;
        width: 40px;
        height: 40px;
        border: 4px solid rgba(245, 158, 11, 0.2);
        border-top-color: #f59e0b;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .loading-text {
        margin-top: 15px;
        font-size: 0.875rem;
      }

      .error {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid #ef4444;
        border-radius: 8px;
        padding: 15px;
        color: #ef4444;
        margin: 10px 0;
        animation: fadeIn 0.3s ease;
      }

      .error-title {
        font-weight: 700;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .error-message {
        font-size: 0.875rem;
        margin-bottom: 12px;
        opacity: 0.9;
      }

      .error-retry {
        padding: 8px 16px;
        background: rgba(239, 68, 68, 0.2);
        border: 1px solid #ef4444;
        border-radius: 6px;
        color: #ef4444;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 600;
        transition: all 0.2s;
      }

      .error-retry:hover {
        background: rgba(239, 68, 68, 0.3);
        transform: translateY(-1px);
      }

      .error-retry:active {
        transform: translateY(0);
      }
    </style>
  `;
}

/**
 * Generate JavaScript for dashboard functionality
 */
function generateScript(config: DashboardConfig): string {
  const { default_interval_ms, slow_interval_ms, fast_interval_ms } = config.dashboard.refresh;

  return `
    <script>
      // Dashboard App
      class DashboardApp {
        constructor(config) {
          this.config = config;
          this.refreshTimers = {};
          this.logPaused = false;
          this.logEventSource = null;
          this.componentStates = {}; // Track loading/error states
        }

        async start() {
          console.log('[Dashboard] Starting...', this.config.dashboard.info.title);

          // Skip initial refresh - use server-rendered content
          // First refresh will happen when timers fire

          // Start auto-refresh loops
          this.startRefreshLoops();

          // Connect log stream if available
          this.connectLogStream();

          // Setup log controls
          this.setupLogControls();
        }

        async refreshAll() {
          const promises = [];

          for (const [sourceId, sourceConfig] of Object.entries(this.config.data_sources)) {
            if (sourceConfig.type === 'http') {
              promises.push(this.fetchAndUpdate(sourceId));
            }
          }

          await Promise.all(promises);
        }

        async fetchAndUpdate(sourceId) {
          const sourceConfig = this.config.data_sources[sourceId];

          // Set loading state for all components using this source
          for (const [componentId, component] of Object.entries(this.config.components)) {
            if (component.data_source === sourceId) {
              this.componentStates[componentId] = { state: 'loading' };
              this.updateComponent(componentId, component, null, 'loading');
            }
          }

          try {
            const response = await fetch(sourceConfig.endpoint, {
              method: sourceConfig.method || 'GET'
            });

            if (!response.ok) {
              throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
            }

            const data = await response.json();

            // Update all components that use this data source
            for (const [componentId, component] of Object.entries(this.config.components)) {
              if (component.data_source === sourceId) {
                this.componentStates[componentId] = { state: 'loaded', data };
                this.updateComponent(componentId, component, data, 'loaded');
              }
            }
          } catch (error) {
            console.error(\`Error fetching \${sourceId}:\`, error);

            // Set error state for all components using this source
            for (const [componentId, component] of Object.entries(this.config.components)) {
              if (component.data_source === sourceId) {
                this.componentStates[componentId] = {
                  state: 'error',
                  error: error.message,
                  sourceId
                };
                this.updateComponent(componentId, component, null, 'error', error.message, sourceId);
              }
            }
          }
        }

        updateComponent(componentId, component, data, state = 'loaded', errorMessage = null, sourceId = null) {
          // Find all elements for this component
          const elements = document.querySelectorAll(\`[data-component="\${componentId}"]\`);

          elements.forEach(element => {
            // Re-render component with new data and state
            element.innerHTML = this.renderComponentContent(component, data, state, errorMessage, sourceId);
          });
        }

        renderComponentContent(component, data, state = 'loaded', errorMessage = null, sourceId = null) {
          // Handle loading state
          if (state === 'loading') {
            return \`
              <div class="loading">
                <div class="loading-spinner"></div>
                <div class="loading-text">Loading...</div>
              </div>
            \`;
          }

          // Handle error state
          if (state === 'error') {
            return \`
              <div class="error">
                <div class="error-title">
                  <span>✗</span>
                  <span>Failed to load data</span>
                </div>
                <div class="error-message">\${errorMessage || 'Unknown error'}</div>
                <button class="error-retry" onclick="window.dashboardApp.fetchAndUpdate('\${sourceId}')">
                  Retry
                </button>
              </div>
            \`;
          }

          // Client-side rendering - extract values and update display

          if (component.type === 'status-indicator' || component.type === 'metric-display') {
            const value = this.extractValue(data, component.value_path);
            const formatted = this.formatValue(value, component.format);
            const label = component.label || '';

            return \`
              <div class="\${component.type}">
                <span class="label">\${label}:</span>
                <span class="value">\${formatted}</span>
              </div>
            \`;
          }

          if (component.type === 'card') {
            const title = component.title || '';
            const items = component.items || [];

            const itemsHtml = items.map(item => {
              const value = this.extractValue(data, item.value_path);
              const formatted = this.formatValue(value, item.format);

              return \`
                <div class="card-item">
                  <span class="item-label">\${item.label}:</span>
                  <span class="item-value">\${formatted}</span>
                </div>
              \`;
            }).join('');

            return \`
              <div class="card">
                <div class="card-title">\${title}</div>
                <div class="card-content">
                  \${itemsHtml}
                </div>
              </div>
            \`;
          }

          if (component.type === 'process-table') {
            const title = component.title || '';
            const columns = component.columns || [];
            const processes = data?.processes || [];

            const headerHtml = columns.map(col => \`<th>\${col}</th>\`).join('');
            const rowsHtml = processes.map(process => {
              const cellsHtml = columns.map(col => {
                let value = process[col];
                if (col === 'uptime' && typeof value === 'number') {
                  value = this.formatValue(value, 'duration');
                } else if (col === 'memory_mb' && typeof value === 'number') {
                  value = \`\${value.toFixed(1)}MB\`;
                } else if (col === 'cpu' && typeof value === 'number') {
                  value = \`\${value.toFixed(1)}%\`;
                } else if (col === 'status') {
                  const statusClass = value === 'online' ? 'status-healthy' : 'status-error';
                  value = \`<span class="\${statusClass}">\${value}</span>\`;
                }
                return \`<td>\${value}</td>\`;
              }).join('');
              return \`<tr>\${cellsHtml}</tr>\`;
            }).join('');

            return \`
              <div class="table-container">
                <div class="table-title">\${title}</div>
                <table class="process-table">
                  <thead><tr>\${headerHtml}</tr></thead>
                  <tbody>\${rowsHtml}</tbody>
                </table>
              </div>
            \`;
          }

          return '<!-- Component type not supported -->';
        }

        extractValue(data, path) {
          if (!path || !path.startsWith('$.')) return undefined;
          const parts = path.substring(2).split('.');
          let current = data;
          for (const part of parts) {
            if (current === null || current === undefined) return undefined;
            current = current[part];
          }
          return current;
        }

        formatValue(value, format) {
          if (value === null || value === undefined) return '-';

          switch (format) {
            case 'number':
              return typeof value === 'number' ? value.toLocaleString() : String(value);
            case 'duration':
              if (typeof value === 'number') {
                const days = Math.floor(value / 86400);
                const hours = Math.floor((value % 86400) / 3600);
                const minutes = Math.floor((value % 3600) / 60);
                if (days > 0) return \`\${days}d \${hours}h\`;
                if (hours > 0) return \`\${hours}h \${minutes}m\`;
                return \`\${minutes}m\`;
              }
              return String(value);
            case 'time-ago':
              if (typeof value === 'string') {
                const date = new Date(value);
                const diffHours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
                if (diffHours < 1) return '< 1h ago';
                if (diffHours < 24) return \`\${diffHours}h ago\`;
                return \`\${Math.floor(diffHours / 24)}d ago\`;
              }
              return String(value);
            case 'countdown':
              if (typeof value === 'string') {
                const diffMinutes = Math.floor((new Date(value).getTime() - Date.now()) / (1000 * 60));
                if (diffMinutes < 0) return 'Overdue';
                if (diffMinutes < 60) return \`\${diffMinutes}m\`;
                return \`\${Math.floor(diffMinutes / 60)}h \${diffMinutes % 60}m\`;
              }
              return String(value);
            case 'percentage':
              return typeof value === 'number' ? \`\${(value * 100).toFixed(1)}%\` : String(value);
            case 'status-icon':
              if (value === 'healthy' || value === 'connected' || value === 'online') return '✓';
              if (value === 'degraded' || value === 'warning') return '⚠';
              if (value === 'unhealthy' || value === 'offline' || value === 'error') return '✗';
              return String(value);
            case 'badge':
              return \`<span class="badge">\${value}</span>\`;
            case 'list-limited':
              if (Array.isArray(value)) {
                const items = value.slice(0, 3);
                return \`<ul>\${items.map(v => \`<li>\${v}</li>\`).join('')}</ul>\`;
              }
              return String(value);
            case 'tag-list':
              if (Array.isArray(value)) {
                return value.map(v => \`<span class="tag">\${v}</span>\`).join(' ');
              }
              return String(value);
            case 'agent-list':
              if (Array.isArray(value)) {
                return value.map(v => \`<div class="agent">\${v.agent_id || v}</div>\`).join('');
              }
              return String(value);
            case 'days':
              return \`\${value} days\`;
            default:
              return String(value);
          }
        }

        startRefreshLoops() {
          const intervals = {
            fast: ${fast_interval_ms},
            default: ${default_interval_ms},
            slow: ${slow_interval_ms}
          };

          // Group components by refresh interval
          const componentsByInterval = { fast: [], default: [], slow: [] };

          for (const [componentId, component] of Object.entries(this.config.components)) {
            const interval = component.refresh_interval || 'default';
            if (!componentsByInterval[interval]) {
              componentsByInterval[interval] = [];
            }
            componentsByInterval[interval].push(componentId);
          }

          // Start refresh timers
          for (const [interval, componentIds] of Object.entries(componentsByInterval)) {
            if (componentIds.length === 0) continue;

            const ms = intervals[interval];
            this.refreshTimers[interval] = setInterval(() => {
              // Get unique data sources used by these components
              const sources = new Set();
              componentIds.forEach(id => {
                const component = this.config.components[id];
                sources.add(component.data_source);
              });

              // Fetch all data sources
              sources.forEach(sourceId => {
                this.fetchAndUpdate(sourceId);
              });
            }, ms);

            console.log(\`[Dashboard] Refresh timer started: \${interval} (\${ms}ms)\`);
          }
        }

        connectLogStream() {
          // Find log data source
          const logSource = Object.entries(this.config.data_sources).find(
            ([id, config]) => config.type === 'sse' && config.endpoint.includes('log')
          );

          if (!logSource) return;

          const [sourceId, sourceConfig] = logSource;
          this.logEventSource = new EventSource(sourceConfig.endpoint);

          this.logEventSource.onmessage = (event) => {
            if (this.logPaused) return;

            try {
              const entry = JSON.parse(event.data);
              this.addLogEntry(entry);
            } catch (error) {
              console.error('Error parsing log entry:', error);
            }
          };

          this.logEventSource.onerror = (error) => {
            console.error('Log stream error:', error);
          };

          console.log('[Dashboard] Log stream connected');
        }

        addLogEntry(entry) {
          const container = document.getElementById('log-entries');
          if (!container) return;

          const maxEntries = parseInt(container.dataset.max || '500');
          const entryHtml = \`
            <div class="log-entry">
              <span class="timestamp">\${entry.timestamp || new Date().toISOString()}</span>
              <span class="source">[\${entry.source || 'unknown'}]</span>
              <span class="message">\${entry.message}</span>
            </div>
          \`;

          container.insertAdjacentHTML('afterbegin', entryHtml);

          // Trim old entries
          while (container.children.length > maxEntries) {
            container.removeChild(container.lastChild);
          }
        }

        setupLogControls() {
          const clearBtn = document.getElementById('log-clear');
          const pauseBtn = document.getElementById('log-pause');
          const exportBtn = document.getElementById('log-export');

          if (clearBtn) {
            clearBtn.addEventListener('click', () => {
              const container = document.getElementById('log-entries');
              if (container) container.innerHTML = '';
            });
          }

          if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
              this.logPaused = !this.logPaused;
              pauseBtn.textContent = this.logPaused ? 'Resume' : 'Pause';
            });
          }

          if (exportBtn) {
            exportBtn.addEventListener('click', () => {
              const container = document.getElementById('log-entries');
              if (!container) return;

              const entries = Array.from(container.children).map(el => el.textContent);
              const blob = new Blob([entries.join('\\n')], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = \`dashboard-logs-\${Date.now()}.txt\`;
              a.click();
              URL.revokeObjectURL(url);
            });
          }
        }

        stop() {
          // Clear all refresh timers
          Object.values(this.refreshTimers).forEach(timer => clearInterval(timer));

          // Close log stream
          if (this.logEventSource) {
            this.logEventSource.close();
          }

          console.log('[Dashboard] Stopped');
        }
      }

      // Start dashboard when DOM is ready
      const config = ${JSON.stringify(config)};
      const app = new DashboardApp(config);

      // Expose app to window for retry buttons
      window.dashboardApp = app;

      document.addEventListener('DOMContentLoaded', () => {
        app.start();
      });

      // Cleanup on page unload
      window.addEventListener('beforeunload', () => {
        app.stop();
      });
    </script>
  `;
}

/**
 * Render a layout section
 */
function renderSection(section: LayoutSection, config: DashboardConfig, initialData: Record<string, any>): string {
  const components = section.components.map(componentId => {
    const component = config.components[componentId];
    if (!component) {
      return `<div class="error">Component not found: ${componentId}</div>`;
    }

    const dataSourceId = component.data_source;
    const data = initialData[dataSourceId] || {};

    return `
      <div data-component="${componentId}">
        ${renderComponent(component, data)}
      </div>
    `;
  }).join("");

  let sectionClass = "";
  if (section.type === "card-grid") {
    sectionClass = `card-grid columns-${section.columns || 2}`;
  } else if (section.type === "status-bar") {
    sectionClass = "status-bar";
  }

  return `
    <div class="${sectionClass}" data-section="${section.id}">
      ${components}
    </div>
  `;
}

/**
 * Render complete dashboard HTML
 */
export function renderDashboard(config: DashboardConfig, initialData: Record<string, any> = {}): string {
  const { title, description } = config.dashboard.info;

  const sectionsHtml = config.layout.sections.map(section =>
    renderSection(section, config, initialData)
  ).join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      ${generateStyles()}
    </head>
    <body>
      <div class="dashboard">
        <div class="dashboard-header">
          <h1 class="dashboard-title">${title}</h1>
          ${description ? `<p class="dashboard-description">${description}</p>` : ""}
        </div>

        ${sectionsHtml}
      </div>

      ${generateScript(config)}
    </body>
    </html>
  `;
}
