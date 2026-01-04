/**
 * Embedding utilities for Recall Service
 *
 * Delegates to the centralized embedding service via HTTP.
 * Shared configuration with memory service.
 */

import { EMBEDDING_SERVICE_URL, EMBEDDING_SERVICE_AUTH_TOKEN } from "./config";

const TIMEOUT = 30000;

interface EmbedResponse {
  embedding: number[];
  dimensions: number;
}

/**
 * Generate embedding for a single text using the embedding service
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || typeof text !== "string") {
    throw new Error("Text must be a non-empty string");
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (EMBEDDING_SERVICE_AUTH_TOKEN) {
      headers["Authorization"] = `Bearer ${EMBEDDING_SERVICE_AUTH_TOKEN}`;
    }

    const response = await fetch(`${EMBEDDING_SERVICE_URL}/embed`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(
        `Embedding service error (${response.status}): ${error.error || response.statusText}`
      );
    }

    const data: EmbedResponse = await response.json();
    console.log(
      `[Recall/Embedding] Generated ${data.dimensions}-dimensional embedding`
    );
    return data.embedding;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error(`Embedding request timed out after ${TIMEOUT}ms`);
      }
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
    throw new Error("Failed to generate embedding: Unknown error");
  }
}
