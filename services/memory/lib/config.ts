/**
 * Configuration for Memory Backend
 *
 * Loads environment variables and creates shared service instances.
 */

// @ts-ignore - Neo4jService is a JS module
import { Neo4jService } from "./neo4j-service.js";

// Environment configuration
export const config = {
  neo4j: {
    uri: process.env.NEO4J_URI || "bolt://localhost:7687",
    user: process.env.NEO4J_USER || "neo4j",
    password: process.env.NEO4J_PASSWORD || "testpassword123",
    database: process.env.NEO4J_DATABASE || "neo4j",
  },
  embedding: {
    serviceUrl: process.env.EMBEDDING_SERVICE_URL || "http://localhost:3007",
    authToken: process.env.EMBEDDING_SERVICE_AUTH_TOKEN,
  },
  server: {
    port: parseInt(process.env.MEMORY_PORT || "3003"),
  },
};

// Shared Neo4j service instance (lazy initialization)
let _neo4jService: typeof Neo4jService | null = null;

export function getNeo4jService(): typeof Neo4jService {
  if (!_neo4jService) {
    _neo4jService = new Neo4jService(
      config.neo4j.uri,
      config.neo4j.user,
      config.neo4j.password
    );
  }
  return _neo4jService;
}

/**
 * Cleanup function for graceful shutdown
 */
export async function cleanup(): Promise<void> {
  if (_neo4jService) {
    await _neo4jService.close();
    _neo4jService = null;
  }
}
