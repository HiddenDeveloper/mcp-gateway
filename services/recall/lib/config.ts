/**
 * Recall Service Configuration
 *
 * Standalone configuration for direct Qdrant access.
 * Recall provides semantic search over conversation history stored in Qdrant.
 */

// Qdrant configuration
export const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
export const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || "conversation-turns";

// Embedding service configuration (shared with memory service)
export const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || "http://localhost:3007";
export const EMBEDDING_SERVICE_AUTH_TOKEN = process.env.EMBEDDING_SERVICE_AUTH_TOKEN;

// Types for conversation turns stored in Qdrant

export interface SchemaParams {
  include_statistics?: boolean;
}

export interface SemanticSearchParams {
  query: string;
  limit?: number;
  threshold?: number;
  filters?: Record<string, unknown>;
}

export interface TextSearchParams {
  query: string;
  limit?: number;
  fields?: string[];
  provider?: string;
  date_from?: string;
  date_to?: string;
}

export interface ConversationTurnPayload {
  turn_id: string;
  conversation_id: string;
  conversation_title: string;
  date_time: string;
  sequence: number;
  role: "user" | "ai";
  provider: string;
  model: string | null;
  text: string;
  embedding_model: string;
  categories?: string[];
  primary_category?: string;
  complexity_level?: "beginner" | "intermediate" | "advanced";
  interaction_type?: "question" | "debugging" | "explanation" | "discussion" | "task";
  topic_tags?: string[];
}

export interface SearchResult {
  score: number;
  payload: ConversationTurnPayload;
  id: number | string;
}
