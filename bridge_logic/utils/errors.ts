/**
 * Error handling utilities for Ailumina Bridge system
 */

import type { AiluminaToolResponse } from '../types.js';

/**
 * Global error handler for consistent error responses
 */
export const handleError = (
  error: unknown,
  context: string
): AiluminaToolResponse => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`[Ailumina Bridge Error] ${context}:`, error);

  return {
    content: [
      {
        type: "text",
        text: `Error in ${context}: ${errorMessage}`,
      },
    ],
    isError: true,
  };
};