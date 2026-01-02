/**
 * System Status Function
 *
 * Health check for Neo4j connection and overall system status.
 */

import { getNeo4jService, config } from "../lib/config";

export async function systemStatus(
  _args: Record<string, unknown>
): Promise<unknown> {
  const service = getNeo4jService();

  const status: Record<string, unknown> = {
    service: "memory-backend",
    timestamp: new Date().toISOString(),
    config: {
      neo4jUri: config.neo4j.uri,
      database: config.neo4j.database,
      embeddingService: config.embedding.serviceUrl,
    },
  };

  // Check Neo4j connection
  try {
    await service.verifyConnection(config.neo4j.database);
    status.neo4j = {
      status: "connected",
      database: config.neo4j.database,
    };
  } catch (error) {
    status.neo4j = {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Check embedding service
  try {
    const response = await fetch(`${config.embedding.serviceUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    status.embeddingService = {
      status: response.ok ? "healthy" : "unhealthy",
      statusCode: response.status,
    };
  } catch (error) {
    status.embeddingService = {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Overall status
  const neo4jOk = (status.neo4j as { status: string }).status === "connected";
  const embeddingOk = (status.embeddingService as { status: string }).status === "healthy";

  status.overall = neo4jOk && embeddingOk ? "healthy" : "degraded";

  return status;
}
