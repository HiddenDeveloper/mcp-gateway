/**
 * Embedding utilities for Memory Backend
 *
 * Delegates to the centralized embedding service via HTTP.
 * Simplified standalone version for the NGINX MCP Gateway POC.
 */

const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || "http://localhost:3007";
const EMBEDDING_SERVICE_AUTH_TOKEN = process.env.EMBEDDING_SERVICE_AUTH_TOKEN;
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
      `[EmbeddingClient] Generated ${data.dimensions}-dimensional embedding`
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

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Embeddings must have the same dimensionality");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
