/**
 * Reload Tools - Self-Evolution API
 * Bridge proxy to server's tool reload endpoint
 */

import type { AiluminaToolResponse } from '../types.js';
import { getCurrentTimestamp } from '../utils/ailumina-utils.js';
import { handleError } from '../utils/errors.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8000';

export class ReloadToolsTool {
  async execute(): Promise<AiluminaToolResponse> {
    try {
      const response = await fetch(`${SERVER_URL}/api/mcp/tools/reload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json() as any;

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: result.error || 'Failed to reload tools',
                timestamp: getCurrentTimestamp(),
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
              message: 'Tool registry reloaded successfully',
              toolCount: result.toolCount,
              timestamp: result.timestamp,
              note: 'New tools are now available for use. Remember to add them to agent available_functions.',
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, "reload_tools");
    }
  }
}
