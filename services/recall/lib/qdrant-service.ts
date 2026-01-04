/**
 * Qdrant Service for Recall
 *
 * Direct REST client for Qdrant vector database.
 * Provides semantic and text search over conversation history.
 */

import { QDRANT_URL, QDRANT_COLLECTION, type SearchResult, type ConversationTurnPayload } from "./config";

interface QdrantCollectionInfo {
  result: {
    status: string;
    optimizer_status: string;
    vectors_count: number;
    indexed_vectors_count: number;
    points_count: number;
    segments_count: number;
    config: {
      params: {
        vectors: {
          size: number;
          distance: string;
        };
      };
    };
  };
}

interface QdrantSearchResult {
  id: number | string;
  score: number;
  payload: ConversationTurnPayload;
}

interface QdrantScrollResult {
  result: {
    points: Array<{
      id: number | string;
      payload: ConversationTurnPayload;
    }>;
    next_page_offset: number | null;
  };
}

/**
 * Qdrant REST API client
 */
export class QdrantService {
  private baseUrl: string;
  private collection: string;

  constructor(url = QDRANT_URL, collection = QDRANT_COLLECTION) {
    this.baseUrl = url;
    this.collection = collection;
  }

  /**
   * Verify connection to Qdrant
   */
  async verifyConnection(): Promise<{ healthy: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/collections/${this.collection}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        return {
          healthy: false,
          message: `Qdrant collection '${this.collection}' not accessible: ${response.status}`,
        };
      }

      const data = await response.json() as QdrantCollectionInfo;
      return {
        healthy: true,
        message: `Connected to Qdrant. Collection '${this.collection}' has ${data.result.points_count} points.`,
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Failed to connect to Qdrant: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Get collection schema and statistics
   */
  async getCollectionInfo(includeStatistics = true): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/collections/${this.collection}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to get collection info: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as QdrantCollectionInfo;

    const schema: Record<string, unknown> = {
      collection_name: this.collection,
      vector_size: data.result.config.params.vectors.size,
      distance_metric: data.result.config.params.vectors.distance,
      status: data.result.status,
      payload_schema: {
        turn_id: "string",
        conversation_id: "string",
        conversation_title: "string",
        date_time: "string (ISO 8601)",
        sequence: "number",
        role: "string (user|ai)",
        provider: "string",
        model: "string|null",
        text: "string",
        categories: "string[]",
        primary_category: "string",
        topic_tags: "string[]",
      },
    };

    if (includeStatistics) {
      schema.statistics = {
        points_count: data.result.points_count,
        vectors_count: data.result.vectors_count,
        indexed_vectors_count: data.result.indexed_vectors_count,
        segments_count: data.result.segments_count,
        optimizer_status: data.result.optimizer_status,
      };
    }

    return schema;
  }

  /**
   * Semantic search using vector similarity
   */
  async semanticSearch(
    vector: number[],
    limit = 10,
    threshold = 0.0,
    filters?: Record<string, unknown>
  ): Promise<SearchResult[]> {
    const body: Record<string, unknown> = {
      vector,
      limit,
      score_threshold: threshold,
      with_payload: true,
    };

    if (filters && Object.keys(filters).length > 0) {
      body.filter = this.buildFilter(filters);
    }

    const response = await fetch(`${this.baseUrl}/collections/${this.collection}/points/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Semantic search failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { result: QdrantSearchResult[] };

    return data.result.map((item) => ({
      score: item.score,
      payload: item.payload,
      id: item.id,
    }));
  }

  /**
   * Text search using scroll with payload filters
   */
  async textSearch(
    query: string,
    limit = 10,
    fields: string[] = ["text", "conversation_title"],
    provider?: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<SearchResult[]> {
    // Build filter conditions
    const mustConditions: unknown[] = [];

    // Text matching - search in specified fields
    const textConditions = fields.map((field) => ({
      key: field,
      match: { text: query },
    }));

    if (textConditions.length > 0) {
      mustConditions.push({
        should: textConditions,
      });
    }

    // Provider filter
    if (provider) {
      mustConditions.push({
        key: "provider",
        match: { value: provider },
      });
    }

    // Date range filters
    if (dateFrom) {
      mustConditions.push({
        key: "date_time",
        range: { gte: dateFrom },
      });
    }
    if (dateTo) {
      mustConditions.push({
        key: "date_time",
        range: { lte: dateTo },
      });
    }

    const body: Record<string, unknown> = {
      limit,
      with_payload: true,
    };

    if (mustConditions.length > 0) {
      body.filter = { must: mustConditions };
    }

    const response = await fetch(`${this.baseUrl}/collections/${this.collection}/points/scroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Text search failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as QdrantScrollResult;

    // Filter results client-side for text matching (Qdrant text match is exact)
    const queryLower = query.toLowerCase();
    const results = data.result.points
      .filter((point) => {
        for (const field of fields) {
          const value = point.payload[field as keyof ConversationTurnPayload];
          if (typeof value === "string" && value.toLowerCase().includes(queryLower)) {
            return true;
          }
        }
        return false;
      })
      .slice(0, limit)
      .map((point) => ({
        score: 1.0, // Text search doesn't have scores, use 1.0
        payload: point.payload,
        id: point.id,
      }));

    return results;
  }

  /**
   * Build Qdrant filter from simple key-value object
   */
  private buildFilter(filters: Record<string, unknown>): Record<string, unknown> {
    const must: unknown[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          // Array filter - match any
          must.push({
            key,
            match: { any: value },
          });
        } else {
          // Exact match
          must.push({
            key,
            match: { value },
          });
        }
      }
    }

    return { must };
  }
}

// Singleton instance
let qdrantServiceInstance: QdrantService | null = null;

export function getQdrantService(): QdrantService {
  if (!qdrantServiceInstance) {
    qdrantServiceInstance = new QdrantService();
  }
  return qdrantServiceInstance;
}
