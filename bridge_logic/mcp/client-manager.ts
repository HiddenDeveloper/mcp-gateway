/**
 * MCP Client Manager
 *
 * Manages connections to multiple MCP servers and routes tool calls.
 * This enables the bridge to orchestrate tools across different MCP servers.
 *
 * Uses Anthropic's official MCP SDK for protocol compliance and session management.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { ToolSchema, MCPServerConfig, MCPServerHealth } from '../types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('MCPClientManager');

interface MCPServer {
  name: string;
  url: string;
  bearerToken?: string | undefined;
  client: Client;
  transport: Transport;
  tools: ToolSchema[];
  healthy: boolean;
  lastHealthCheck: Date;
}

export class MCPClientManager {
  private servers: Map<string, MCPServer> = new Map();
  private toolToServerMap: Map<string, string> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(private serverConfigs: MCPServerConfig[]) {}

  /**
   * Initialize all MCP server connections
   */
  async initialize(): Promise<void> {
    logger.info(`Initializing ${this.serverConfigs.length} MCP servers...`);

    for (const config of this.serverConfigs) {
      try {
        await this.connectServer(config);
      } catch (error) {
        // Log at warn level for optional services, error for critical ones
        const criticalServers = ['memory', 'mesh', 'bridge'];
        const logLevel = criticalServers.includes(config.name) ? 'error' : 'warn';
        logger[logLevel](`Failed to connect to ${config.name}: ${error instanceof Error ? error.message : String(error)}`);
        // Continue with other servers even if one fails
      }
    }

    // Start health check interval (every 60 seconds)
    this.startHealthChecks();

    logger.info(`Initialized ${this.servers.size}/${this.serverConfigs.length} servers`);
  }

  /**
   * Dynamically add a new MCP server at runtime
   * Connects to the server and loads its tools without requiring restart
   */
  async addServer(config: MCPServerConfig): Promise<{ success: boolean; message: string; toolCount?: number }> {
    // Check if server already exists
    if (this.servers.has(config.name)) {
      return {
        success: false,
        message: `Server ${config.name} is already registered. Use removeServer first if you want to replace it.`
      };
    }

    try {
      await this.connectServer(config);
      const server = this.servers.get(config.name);
      return {
        success: true,
        message: `Successfully registered MCP server: ${config.name}`,
        toolCount: server?.tools.length || 0
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to register ${config.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Dynamically remove an MCP server at runtime
   * Disconnects and removes all tools from the server
   */
  async removeServer(serverName: string): Promise<{ success: boolean; message: string }> {
    const server = this.servers.get(serverName);

    if (!server) {
      return {
        success: false,
        message: `Server ${serverName} not found`
      };
    }

    try {
      // Close the transport connection
      await server.transport.close();

      // Remove all tools from this server from the tool map
      for (const tool of server.tools) {
        this.toolToServerMap.delete(tool.name);
      }

      // Remove server from servers map
      this.servers.delete(serverName);

      return {
        success: true,
        message: `Successfully unregistered MCP server: ${serverName} (removed ${server.tools.length} tools)`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to unregister ${serverName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Connect to a single MCP server and load its tools
   * Uses MCP SDK for proper session initialization and protocol compliance
   */
  private async connectServer(config: MCPServerConfig): Promise<void> {
    logger.info(`Connecting to ${config.name} at ${config.url}...`);

    // Determine transport type (default to streamablehttp for backwards compatibility)
    const transportType = config.transport || 'streamablehttp';
    logger.debug(`Using ${transportType} transport for ${config.name}`);

    // Create appropriate MCP transport based on configuration
    let transport;

    if (transportType === 'sse') {
      // SSE transport for servers that only support Server-Sent Events
      transport = new SSEClientTransport(
        new URL(config.url),
        config.bearerToken ? {
          requestInit: {
            headers: {
              'Authorization': `Bearer ${config.bearerToken}`,
            },
          },
        } : undefined
      );
    } else {
      // StreamableHTTP transport for bidirectional communication
      transport = new StreamableHTTPClientTransport(
        new URL(config.url),
        {
          requestInit: config.bearerToken ? {
            headers: {
              'Authorization': `Bearer ${config.bearerToken}`,
              'Accept': 'application/json, text/event-stream',
            },
          } : {
            headers: {
              'Accept': 'application/json, text/event-stream',
            },
          },
        }
      );
    }

    // Create MCP client
    const client = new Client(
      {
        name: 'ailumina-bridge-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Connect client to transport (handles session initialization automatically)
    await client.connect(transport as any); // Type assertion for SDK compatibility

    // Fetch tools from MCP server
    const toolsResult = await client.listTools({});
    const tools = toolsResult.tools || [];

    // Add server name prefix to tool names
    // Keep original descriptions from MCP servers
    // Explicitly preserve examples and annotations for progressive disclosure
    const prefixedTools = tools.map(tool => ({
      ...tool,
      name: `${config.name}_${tool.name}`,
      // Original description from MCP server, with server name appended for context
      description: tool.description ? `${tool.description} (from ${config.name} server)` : `Tool from ${config.name} server`,
      // Extract examples from _meta field (MCP protocol uses _meta for custom fields)
      examples: (tool as any)._meta?.examples || [],
      annotations: (tool as any).annotations,
    })) as ToolSchema[]; // Type assertion - SDK's Tool type is compatible with our ToolSchema

    // Store server info with client
    this.servers.set(config.name, {
      name: config.name,
      url: config.url,
      bearerToken: config.bearerToken,
      client,
      transport: transport as Transport, // Type assertion for SDK compatibility
      tools: prefixedTools,
      healthy: true,
      lastHealthCheck: new Date()
    });

    // Build tool → server mapping
    for (const tool of prefixedTools) {
      this.toolToServerMap.set(tool.name, config.name);
    }

    logger.info(`Connected to ${config.name}: ${prefixedTools.length} tools loaded`);
  }

  /**
   * Get all tools available to a specific agent
   * @param agentName - Agent name (for logging)
   * @param mcpServers - Full access MCP servers (all tools)
   * @param mcpTools - Granular MCP tools per server (e.g., {"memory": ["semantic_search"]})
   */
  getToolsForAgent(
    agentName: string,
    mcpServers: string[],
    mcpTools?: Record<string, string[]>
  ): ToolSchema[] {
    const tools: ToolSchema[] = [];
    const processedServers = new Set<string>();

    // First, add all tools from full-access servers
    for (const serverName of mcpServers) {
      const server = this.servers.get(serverName);
      if (server) {
        // Check if this server has granular filtering
        const specificTools = mcpTools?.[serverName];
        if (specificTools && specificTools.length > 0) {
          // Granular: only add specified tools
          for (const tool of server.tools) {
            const shortName = tool.name.replace(`${serverName}_`, '');
            if (specificTools.includes(shortName) || specificTools.includes(tool.name)) {
              tools.push(tool);
            }
          }
        } else {
          // Full access: add all tools
          tools.push(...server.tools);
        }
        processedServers.add(serverName);
      }
    }

    // Then, add granular tools from servers NOT in mcpServers
    if (mcpTools) {
      for (const [serverName, specificTools] of Object.entries(mcpTools)) {
        if (processedServers.has(serverName)) continue; // Already handled
        if (!specificTools || specificTools.length === 0) continue;

        const server = this.servers.get(serverName);
        if (server) {
          for (const tool of server.tools) {
            const shortName = tool.name.replace(`${serverName}_`, '');
            if (specificTools.includes(shortName) || specificTools.includes(tool.name)) {
              tools.push(tool);
            }
          }
        }
      }
    }

    return tools;
  }

  /**
   * Get just tool names for an agent
   */
  getToolNamesForAgent(
    agentName: string,
    mcpServers: string[],
    mcpTools?: Record<string, string[]>
  ): string[] {
    return this.getToolsForAgent(agentName, mcpServers, mcpTools).map(t => t.name);
  }

  /**
   * Call a tool on the appropriate MCP server
   * Uses MCP SDK for protocol-compliant tool invocation
   *
   * @param toolName - The prefixed tool name (e.g., "protocol-orchestrator_execute_protocol")
   * @param args - Tool arguments
   * @param options - Optional settings including timeout
   * @param options.timeout - Request timeout in milliseconds (default: 60000, use 300000 for long-running tools)
   */
  async callTool(toolName: string, args: any, options?: { timeout?: number }): Promise<any> {
    const serverName = this.toolToServerMap.get(toolName);

    if (!serverName) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    const server = this.servers.get(serverName);

    if (!server) {
      throw new Error(`Server not found for tool: ${toolName}`);
    }

    if (!server.healthy) {
      throw new Error(`Server ${serverName} is unhealthy`);
    }

    // Remove server prefix from tool name
    const unprefixedToolName = toolName.replace(`${serverName}_`, '');

    // Default timeout for long-running protocol executions (5 minutes)
    // Can be overridden by passing options.timeout
    const timeout = options?.timeout ?? 300000; // 5 minutes default for bridge calls

    logger.debug(`Calling ${serverName}.${unprefixedToolName} (timeout: ${timeout}ms)`);

    // Use SDK's callTool method with timeout option
    const result = await server.client.callTool(
      {
        name: unprefixedToolName,
        arguments: args
      },
      undefined, // Use default result schema
      { timeout }
    );

    return result;
  }

  /**
   * Get health status of all MCP servers
   */
  getServerHealth(): MCPServerHealth[] {
    return Array.from(this.servers.values()).map(server => ({
      name: server.name,
      url: server.url,
      healthy: server.healthy,
      lastHealthCheck: server.lastHealthCheck.toISOString(),
      toolCount: server.tools.length
    }));
  }

  /**
   * Check health of a specific server
   */
  private async checkServerHealth(serverName: string): Promise<boolean> {
    const server = this.servers.get(serverName);
    if (!server) return false;

    try {
      const response = await fetch(`${server.url}/health`, {
        method: 'GET',
        headers: server.bearerToken ? { 'Authorization': `Bearer ${server.bearerToken}` } : {}
      });

      const healthy = response.ok;
      server.healthy = healthy;
      server.lastHealthCheck = new Date();

      return healthy;
    } catch (error) {
      server.healthy = false;
      server.lastHealthCheck = new Date();
      return false;
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const serverName of this.servers.keys()) {
        await this.checkServerHealth(serverName);
      }
    }, 60_000); // Every 60 seconds
  }

  /**
   * Stop health checks and cleanup
   * Properly closes all MCP client connections
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Close all MCP client connections
    for (const [serverName, server] of this.servers.entries()) {
      try {
        await server.transport.close();
        logger.info(`Closed connection to ${serverName}`);
      } catch (error) {
        logger.error(`Error closing ${serverName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.servers.clear();
    this.toolToServerMap.clear();
  }

  /**
   * Reload tools from all servers (for hot-reload)
   */
  async reload(): Promise<void> {
    logger.info('Reloading all MCP servers...');
    await this.shutdown();
    await this.initialize();
  }
}
