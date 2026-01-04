/**
 * Recall Service Configuration
 *
 * Proxies to the existing ai-recall-mcp HTTP server.
 * Recall provides semantic search over conversation history stored in Qdrant.
 */

// Recall HTTP server URL and auth
export const RECALL_URL = process.env.RECALL_URL || "http://localhost:3006";
export const RECALL_TOKEN = process.env.RECALL_AUTH_TOKEN || "recall-research-key-12345";

// Types matching ai-recall-mcp

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
  id: number;
}

/**
 * Call the Recall MCP server via JSON-RPC
 */
export async function callRecallTool(
  toolName: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  const response = await fetch(`${RECALL_URL}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RECALL_TOKEN}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: toolName,
        arguments: params,
      },
      id: Date.now(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Recall server error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.error) {
    throw new Error(result.error.message || "Recall tool error");
  }

  // Extract text content from MCP response
  const content = result.result?.content;
  if (Array.isArray(content) && content.length > 0) {
    const textContent = content.find((c: { type: string }) => c.type === "text");
    if (textContent?.text) {
      // Try to parse as JSON, otherwise return as-is
      try {
        return JSON.parse(textContent.text);
      } catch {
        return { text: textContent.text };
      }
    }
  }

  return result.result;
}
