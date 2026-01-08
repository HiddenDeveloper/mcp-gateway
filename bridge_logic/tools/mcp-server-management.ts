/**
 * MCP Server Management Tools - Self-Evolution API
 * Dynamic registration and management of MCP servers at runtime
 */

import type { AiluminaToolResponse } from '../types.js';
import type { MCPClientManager } from '../mcp/client-manager.js';
import { getCurrentTimestamp } from '../utils/ailumina-utils.js';
import { handleError } from '../utils/errors.js';

// Global reference to MCPClientManager (set by server on startup)
let mcpClientManagerInstance: MCPClientManager | null = null;

export function setMCPClientManager(manager: MCPClientManager): void {
  mcpClientManagerInstance = manager;
}

function getMCPClientManager(): MCPClientManager {
  if (!mcpClientManagerInstance) {
    throw new Error('MCPClientManager not initialized. This is a server initialization error.');
  }
  return mcpClientManagerInstance;
}

export class RegisterMcpServerTool {
  async execute(params: {
    name: string;
    url: string;
    bearerToken?: string;
    transport?: 'streamablehttp' | 'sse';
  }): Promise<AiluminaToolResponse> {
    try {
      const manager = getMCPClientManager();

      const result = await manager.addServer({
        name: params.name,
        url: params.url,
        bearerToken: params.bearerToken,
        transport: params.transport
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ...result,
              timestamp: getCurrentTimestamp(),
              note: result.success
                ? `MCP server "${params.name}" is now available. Its tools are prefixed with "${params.name}_".`
                : undefined
            }, null, 2),
          },
        ],
        isError: !result.success,
      };
    } catch (error) {
      return handleError(error, "register_mcp_server");
    }
  }
}

export class UnregisterMcpServerTool {
  async execute(params: { name: string }): Promise<AiluminaToolResponse> {
    try {
      const manager = getMCPClientManager();

      const result = await manager.removeServer(params.name);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ...result,
              timestamp: getCurrentTimestamp(),
            }, null, 2),
          },
        ],
        isError: !result.success,
      };
    } catch (error) {
      return handleError(error, "unregister_mcp_server");
    }
  }
}

export class ListMcpServersTool {
  async execute(): Promise<AiluminaToolResponse> {
    try {
      const manager = getMCPClientManager();

      const servers = manager.getServerHealth();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              servers,
              totalServers: servers.length,
              healthyServers: servers.filter(s => s.healthy).length,
              timestamp: getCurrentTimestamp(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, "list_mcp_servers");
    }
  }
}

/**
 * Direct function call tool - calls any function without requiring agent context
 *
 * This is useful for:
 * - Validating functions work correctly
 * - Testing tool implementations
 * - Programmatic access to functions without agent overhead
 */
export class CallFunctionTool {
  private ailuminaUrl: string;

  constructor(ailuminaUrl: string = 'http://localhost:8000') {
    this.ailuminaUrl = ailuminaUrl;
  }

  async execute(params: {
    function_name: string;
    arguments?: Record<string, unknown>;
  }): Promise<AiluminaToolResponse> {
    try {
      const { function_name, arguments: args = {} } = params;

      // Call ailumina server's direct function endpoint
      const response = await fetch(
        `${this.ailuminaUrl}/api/mcp/functions/${encodeURIComponent(function_name)}/call`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: result.error || 'Function call failed',
                message: result.message,
                ...(result.available && { available_functions: result.available }),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              function: function_name,
              arguments: args,
              result: result.result,
              timestamp: getCurrentTimestamp(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, "call_function");
    }
  }
}
