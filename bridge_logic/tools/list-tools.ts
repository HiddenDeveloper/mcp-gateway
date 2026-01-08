/**
 * List Tools - Self-Evolution API
 * Bridge proxy to server's tool listing endpoint
 */

import type { AiluminaToolResponse } from '../types.js';
import { getCurrentTimestamp } from '../utils/ailumina-utils.js';
import { handleError } from '../utils/errors.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8000';

export class ListToolsTool {
  async execute(): Promise<AiluminaToolResponse> {
    try {
      const response = await fetch(`${SERVER_URL}/api/tools`, {
        method: 'GET',
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
                error: result.error || 'Failed to list tools',
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
              tools: result.tools,
              count: result.count,
              timestamp: getCurrentTimestamp(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, "list_tools");
    }
  }
}
