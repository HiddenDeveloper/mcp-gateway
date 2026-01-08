/**
 * Reload Agents - Self-Evolution API
 * Hot-reload agent configurations from server without restart
 */

import type { AiluminaToolResponse } from '../types.js';
import type { AgentConfigLoader } from '../config/agent-loader.js';
import { getCurrentTimestamp } from '../utils/ailumina-utils.js';
import { handleError } from '../utils/errors.js';

// Global reference to AgentConfigLoader (set by server on startup)
let agentConfigLoaderInstance: AgentConfigLoader | null = null;

export function setAgentConfigLoader(loader: AgentConfigLoader): void {
  agentConfigLoaderInstance = loader;
}

function getAgentConfigLoader(): AgentConfigLoader {
  if (!agentConfigLoaderInstance) {
    throw new Error('AgentConfigLoader not initialized. This is a server initialization error.');
  }
  return agentConfigLoaderInstance;
}

export class ReloadAgentsTool {
  async execute(): Promise<AiluminaToolResponse> {
    try {
      const loader = getAgentConfigLoader();

      // Reload agents from server
      await loader.reload();

      const agents = loader.listAgents();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: 'Agent configurations reloaded successfully',
              agentCount: agents.length,
              agents: agents.map(a => ({
                name: a.name,
                description: a.description,
                mcp_servers: a.mcp_servers
              })),
              timestamp: getCurrentTimestamp(),
              note: 'Bridge has refreshed agent metadata. New/updated agents are now available for tier tools.',
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, "reload_agents");
    }
  }
}
