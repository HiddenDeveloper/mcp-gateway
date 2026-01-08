/**
 * Delete Tool - Self-Evolution API
 * Bridge proxy to server's tool deletion endpoint
 */

import type { AiluminaToolResponse } from '../types.js';
import { getCurrentTimestamp } from '../utils/ailumina-utils.js';
import { handleError } from '../utils/errors.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8000';

interface DeleteToolParams {
  toolName: string;
}

export class DeleteToolTool {
  async execute(params: DeleteToolParams): Promise<AiluminaToolResponse> {
    try {
      const { toolName } = params;

      const response = await fetch(`${SERVER_URL}/api/tools/${encodeURIComponent(toolName)}`, {
        method: 'DELETE',
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
                error: result.error || 'Failed to delete tool',
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
              message: result.message,
              reload: result.reload,
              timestamp: getCurrentTimestamp(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, "delete_tool");
    }
  }
}
