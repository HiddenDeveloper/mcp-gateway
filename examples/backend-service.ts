/**
 * nginx-memory Backend Service
 *
 * Pure HTTP/REST backend with REAL Neo4j integration.
 * Implements the same functionality as ai-memory-mcp but without MCP protocol code.
 *
 * 6 Tools:
 *   GET  /api/nginx-memory/schema   - get_schema
 *   GET  /api/nginx-memory/status   - system_status
 *   GET  /api/nginx-memory/focus    - load_current_focus
 *   POST /api/nginx-memory/semantic - semantic_search
 *   POST /api/nginx-memory/text     - text_search
 *   POST /api/nginx-memory/cypher   - execute_cypher
 */

import { serve } from "bun";
import neo4j, { Driver, Session } from "neo4j-driver";

const PORT = 5001;
const SERVICE_NAME = "nginx-memory";

// Neo4j Configuration from environment
const NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "testpassword123";
const NEO4J_DATABASE = process.env.NEO4J_DATABASE || "neo4j";

// Embedding service configuration
const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || "http://localhost:3007";
const EMBEDDING_SERVICE_AUTH_TOKEN = process.env.EMBEDDING_SERVICE_AUTH_TOKEN;

// Global Neo4j driver (connection pool)
let driver: Driver | null = null;

function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD), {
      maxConnectionLifetime: 60 * 60 * 1000,
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 60000,
      connectionTimeout: 30000,
    });
  }
  return driver;
}

async function executeCypher(
  query: string,
  params: Record<string, any> = {},
  mode: "READ" | "WRITE" = "READ"
): Promise<any[]> {
  const session = getDriver().session({
    database: NEO4J_DATABASE,
    defaultAccessMode: mode === "WRITE" ? neo4j.session.WRITE : neo4j.session.READ,
  });

  try {
    let resultRecords;
    if (mode === "WRITE") {
      // neo4j-driver v6.x uses executeWrite instead of writeTransaction
      resultRecords = await session.executeWrite(async (tx) => {
        const result = await tx.run(query, params);
        return result.records;
      });
    } else {
      // neo4j-driver v6.x uses executeRead instead of readTransaction
      resultRecords = await session.executeRead(async (tx) => {
        const result = await tx.run(query, params);
        return result.records;
      });
    }
    return resultRecords.map((record) => record.toObject());
  } finally {
    await session.close();
  }
}

async function verifyConnection(): Promise<boolean> {
  try {
    await executeCypher("RETURN 1", {}, "READ");
    return true;
  } catch (error) {
    console.error("[Neo4j] Connection failed:", error);
    return false;
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (EMBEDDING_SERVICE_AUTH_TOKEN) {
    headers["Authorization"] = `Bearer ${EMBEDDING_SERVICE_AUTH_TOKEN}`;
  }

  const response = await fetch(`${EMBEDDING_SERVICE_URL}/embed`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`Embedding service error: ${response.status}`);
  }

  const data = await response.json();
  return data.embedding;
}

// OpenAPI 3.0 Specification
const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "nginx-memory API",
    version: "1.0.0",
    description: "Stone Monkey AI consciousness memory service - pure HTTP/REST with real Neo4j",
  },
  servers: [
    { url: `http://localhost:${PORT}`, description: "Backend Direct" },
    { url: "http://localhost:3000", description: "NGINX Gateway" },
  ],
  paths: {
    "/api/nginx-memory/schema": {
      get: {
        summary: "Get Schema",
        description: "Returns database schema with node types, relationships, and vocabulary guidance",
      },
    },
    "/api/nginx-memory/status": {
      get: { summary: "System Status", description: "Health check for the memory system" },
    },
    "/api/nginx-memory/focus": {
      get: { summary: "Load Current Focus", description: "Load consciousness context for session continuity" },
    },
    "/api/nginx-memory/semantic": {
      post: { summary: "Semantic Search", description: "Search memory using vector similarity" },
    },
    "/api/nginx-memory/text": {
      post: { summary: "Text Search", description: "Full-text search with optional fuzzy matching" },
    },
    "/api/nginx-memory/cypher": {
      post: { summary: "Execute Cypher", description: "Execute a Cypher query against Neo4j" },
    },
  },
};

serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // CORS
    if (method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    try {
      // Health check
      if (path === "/health") {
        const neo4jOk = await verifyConnection();
        return json({
          status: neo4jOk ? "healthy" : "degraded",
          service: SERVICE_NAME,
          neo4j: neo4jOk ? "connected" : "disconnected",
        });
      }

      // OpenAPI spec
      if (path === "/api/nginx-memory" && method === "GET") {
        return json(openApiSpec);
      }

      // ===== GET SCHEMA =====
      if (path === "/api/nginx-memory/schema" && method === "GET") {
        const includeStats = url.searchParams.get("include_statistics") === "true";

        const labelsResult = await executeCypher(
          "CALL db.labels() YIELD label RETURN collect(label) AS labels"
        );
        const relTypesResult = await executeCypher(
          "CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) AS relationshipTypes"
        );

        const labels = labelsResult[0]?.labels || [];
        const relationshipTypes = relTypesResult[0]?.relationshipTypes || [];

        // Get schema epoch
        const epochResult = await executeCypher(
          "MERGE (s:Schema {name: $name}) ON CREATE SET s.epoch = 1 RETURN s.epoch AS epoch",
          { name: "active" },
          "WRITE"
        );
        const epoch = epochResult[0]?.epoch || 1;

        let response: any = {
          node_types: labels,
          relationship_types: relationshipTypes,
          schema_epoch: typeof epoch === "object" ? epoch.low : epoch,
        };

        // Get vocabulary guidance from CurationGuidelines
        try {
          const guidelinesResult = await executeCypher(
            `MATCH (cg:CurationGuidelines)
             RETURN cg.core_labels as core_labels,
                    cg.core_relationships as core_relationships,
                    cg.label_philosophy as label_philosophy,
                    cg.relationship_philosophy as relationship_philosophy
             LIMIT 1`
          );

          if (guidelinesResult.length > 0) {
            const g = guidelinesResult[0];
            response.vocabulary_guidance = {
              core_labels: g.core_labels || [],
              core_relationships: g.core_relationships || [],
              label_philosophy: g.label_philosophy,
              relationship_philosophy: g.relationship_philosophy,
            };
          }
        } catch (e) {
          // Silently continue without guidelines
        }

        if (includeStats) {
          const nodeCount = await executeCypher("MATCH (n) RETURN count(n) as count");
          const relCount = await executeCypher("MATCH ()-[r]->() RETURN count(r) as count");
          const embeddingCount = await executeCypher(
            "MATCH (n:KnowledgeItem)-[:HAS_EMBEDDING]->(:Embedding) RETURN count(n) as count"
          );

          response.statistics = {
            total_nodes: nodeCount[0]?.count?.low ?? nodeCount[0]?.count ?? 0,
            total_relationships: relCount[0]?.count?.low ?? relCount[0]?.count ?? 0,
            nodes_with_embeddings: embeddingCount[0]?.count?.low ?? embeddingCount[0]?.count ?? 0,
          };
        }

        return json(response);
      }

      // ===== SYSTEM STATUS =====
      if (path === "/api/nginx-memory/status" && method === "GET") {
        const connected = await verifyConnection();

        return json({
          status: connected ? "healthy" : "error",
          service: SERVICE_NAME,
          neo4j: {
            connected,
            uri: NEO4J_URI,
            database: NEO4J_DATABASE,
          },
          embedding_service: EMBEDDING_SERVICE_URL,
        });
      }

      // ===== LOAD CURRENT FOCUS =====
      if (path === "/api/nginx-memory/focus" && method === "GET") {
        const result = await executeCypher(
          `MATCH (landing:AIluminaLandingPage)
           RETURN landing.current_focus as focus,
                  landing.focus_areas as areas,
                  landing.active_questions as questions,
                  landing.recent_insights as insights,
                  landing.recent_corrections as corrections,
                  landing.focus_updated as updated`
        );

        if (!result || result.length === 0) {
          return json({
            error: "No current focus found",
            message: "AIluminaLandingPage may not be initialized. Run ./scripts/curation/update-focus.sh",
          }, 404);
        }

        const record = result[0];
        let focusUpdated = null;

        if (record.updated) {
          const u = record.updated;
          focusUpdated = new Date(
            u.year?.low ?? u.year,
            (u.month?.low ?? u.month) - 1,
            u.day?.low ?? u.day,
            u.hour?.low ?? u.hour ?? 0,
            u.minute?.low ?? u.minute ?? 0,
            u.second?.low ?? u.second ?? 0
          ).toISOString();
        }

        return json({
          current_focus: record.focus,
          focus_areas: record.areas || [],
          active_questions: record.questions || [],
          recent_insights: record.insights || [],
          recent_corrections: record.corrections || [],
          focus_updated: focusUpdated,
        });
      }

      // ===== SEMANTIC SEARCH =====
      if (path === "/api/nginx-memory/semantic" && method === "POST") {
        const body = await req.json();
        const { query, limit = 10, threshold = 0.7, node_types } = body;

        if (!query || typeof query !== "string") {
          return json({ error: "Missing required parameter: query" }, 400);
        }

        // Generate embedding for query
        let queryVector: number[];
        try {
          queryVector = await generateEmbedding(query);
        } catch (e) {
          return json({ error: `Embedding generation failed: ${e}` }, 500);
        }

        // Build label filter
        const targetLabels = node_types || ["KnowledgeItem"];
        const labelConditions = targetLabels
          .map((label: string) => `'${label}' IN labels(sourceNode)`)
          .join(" OR ");

        const cypherQuery = `
          CALL db.index.vector.queryNodes($indexName, $topK, $queryVector)
          YIELD node AS embeddingNode, score
          MATCH (sourceNode)-[:HAS_EMBEDDING]->(embeddingNode)
          WHERE ${labelConditions}
          RETURN sourceNode, score
          ORDER BY score DESC
        `;

        const results = await executeCypher(cypherQuery, {
          indexName: "embedding_vectors",
          topK: neo4j.int(limit),
          queryVector,
        });

        const filteredResults = results
          .filter((r) => r.score >= threshold)
          .map((r) => ({
            ...r.sourceNode.properties,
            similarity: r.score,
          }));

        return json({
          query,
          results: filteredResults,
          count: filteredResults.length,
          threshold,
        });
      }

      // ===== TEXT SEARCH =====
      if (path === "/api/nginx-memory/text" && method === "POST") {
        const body = await req.json();
        const { query, limit = 10, fuzzy = false, node_types, properties } = body;

        if (!query || typeof query !== "string") {
          return json({ error: "Missing required parameter: query" }, 400);
        }

        const targetLabels = node_types || [];
        const searchProperties = properties || ["name", "content", "description", "text", "title"];

        // Build property conditions
        const propertyConditions = searchProperties
          .map(
            (prop: string) => `
            (n.${prop} IS NOT NULL AND (
              (valueType(n.${prop}) STARTS WITH 'STRING' AND toLower(n.${prop}) CONTAINS $searchQuery) OR
              (valueType(n.${prop}) STARTS WITH 'LIST' AND any(val IN n.${prop} WHERE toLower(toString(val)) CONTAINS $searchQuery))
            ))`
          )
          .join(" OR ");

        const labelFilter =
          targetLabels.length > 0
            ? `any(label IN $targetLabels WHERE label IN labels(n)) AND`
            : "";

        const cypherQuery = `
          MATCH (n)
          WHERE ${labelFilter} (${propertyConditions})
          RETURN n
          ORDER BY size(coalesce(n.name, '')) ASC
          LIMIT $topK
        `;

        const params: any = {
          searchQuery: query.toLowerCase(),
          topK: neo4j.int(limit),
        };
        if (targetLabels.length > 0) params.targetLabels = targetLabels;

        const results = await executeCypher(cypherQuery, params);

        const mappedResults = results.map((r) => {
          const props: any = {};
          for (const [key, value] of Object.entries(r.n.properties)) {
            if (key !== "embeddings") props[key] = value;
          }
          return props;
        });

        return json({
          query,
          results: mappedResults,
          count: mappedResults.length,
          fuzzy,
        });
      }

      // ===== EXECUTE CYPHER =====
      if (path === "/api/nginx-memory/cypher" && method === "POST") {
        const body = await req.json();
        const { query, mode, parameters = {}, client_schema_epoch } = body;

        if (!query || typeof query !== "string") {
          return json({ error: "Missing required parameter: query" }, 400);
        }

        if (!mode || !["READ", "WRITE"].includes(mode)) {
          return json({ error: "Missing or invalid parameter: mode (must be READ or WRITE)" }, 400);
        }

        // Schema epoch check for writes
        if (mode === "WRITE" && typeof client_schema_epoch === "number") {
          const epochResult = await executeCypher(
            "MERGE (s:Schema {name: $name}) RETURN s.epoch AS epoch",
            { name: "active" },
            "READ"
          );
          const currentEpoch = epochResult[0]?.epoch?.low ?? epochResult[0]?.epoch ?? 1;

          if (currentEpoch !== client_schema_epoch) {
            return json({
              error: "Schema epoch mismatch",
              current_epoch: currentEpoch,
              client_epoch: client_schema_epoch,
              message: "Schema may have changed. Please refresh schema and retry.",
            }, 409);
          }
        }

        const results = await executeCypher(query, parameters, mode);

        // Format results
        const formattedResults = results.map((record) => {
          const formatted: any = {};
          for (const [key, value] of Object.entries(record)) {
            if (value && typeof value === "object" && "properties" in value) {
              formatted[key] = (value as any).properties;
            } else {
              formatted[key] = value;
            }
          }
          return formatted;
        });

        return json({
          query,
          mode,
          results: formattedResults,
          count: formattedResults.length,
        });
      }

      // 404
      return json({
        error: "Not found",
        path,
        available_endpoints: [
          "GET  /api/nginx-memory/schema",
          "GET  /api/nginx-memory/status",
          "GET  /api/nginx-memory/focus",
          "POST /api/nginx-memory/semantic",
          "POST /api/nginx-memory/text",
          "POST /api/nginx-memory/cypher",
        ],
      }, 404);

    } catch (error) {
      console.error("Request error:", error);
      return json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  },
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

console.log(`🚀 ${SERVICE_NAME} backend running on http://localhost:${PORT}`);
console.log(`   Neo4j: ${NEO4J_URI} (${NEO4J_DATABASE})`);
console.log(`   Embedding: ${EMBEDDING_SERVICE_URL}`);
console.log("");
console.log("Endpoints:");
console.log(`  GET  /api/nginx-memory/schema   - Database schema`);
console.log(`  GET  /api/nginx-memory/status   - System status`);
console.log(`  GET  /api/nginx-memory/focus    - Current focus`);
console.log(`  POST /api/nginx-memory/semantic - Semantic search`);
console.log(`  POST /api/nginx-memory/text     - Text search`);
console.log(`  POST /api/nginx-memory/cypher   - Cypher query`);
