/**
 * Execute Cypher
 *
 * Executes a Cypher query with READ/WRITE mode control.
 * This is the core function that enables LLM memory curation.
 */

import { getNeo4jService, config } from "./lib/config";

interface Params {
  query: string;
  mode: "READ" | "WRITE";
  parameters?: Record<string, unknown>;
  client_schema_epoch?: number;
}

export default async function(params: Record<string, unknown>) {
  const { query, mode, parameters = {}, client_schema_epoch } = params as Params;

  if (!query) {
    throw new Error("Missing required parameter: query");
  }

  if (!mode || (mode !== "READ" && mode !== "WRITE")) {
    throw new Error("Mode must be 'READ' or 'WRITE'");
  }

  const service = getNeo4jService();

  try {
    await service.verifyConnection();

    // For WRITE operations, optionally check schema epoch
    if (mode === "WRITE" && client_schema_epoch !== undefined) {
      const currentEpoch = await service.getOrInitSchemaEpoch(config.neo4j.database);
      if (client_schema_epoch !== currentEpoch) {
        return {
          error: "schema_epoch_mismatch",
          message: `Schema has changed. Client epoch: ${client_schema_epoch}, current: ${currentEpoch}. Please refresh schema.`,
          currentEpoch,
        };
      }
    }

    const results = await service.executeCypher(
      query,
      parameters,
      mode,
      config.neo4j.database
    );

    // Process results - convert Neo4j integers and format nodes
    const processedResults = results.map((record: Record<string, unknown>) => {
      const processed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(record)) {
        if (value && typeof value === "object") {
          // Handle Neo4j nodes
          if ("properties" in value && "labels" in value) {
            processed[key] = {
              labels: (value as { labels: string[] }).labels,
              properties: (value as { properties: Record<string, unknown> }).properties,
            };
          }
          // Handle Neo4j integers
          else if ("low" in value && "high" in value) {
            processed[key] = (value as { toNumber: () => number }).toNumber?.() || value;
          } else {
            processed[key] = value;
          }
        } else {
          processed[key] = value;
        }
      }
      return processed;
    });

    return {
      records: processedResults,
      count: processedResults.length,
      mode,
    };
  } catch (error) {
    console.error("[execute_cypher] Error:", error);
    throw error;
  }
}
