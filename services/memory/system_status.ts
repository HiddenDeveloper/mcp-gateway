/**
 * System Status
 *
 * Check Neo4j connection health and return database statistics.
 */

import { getNeo4jService } from "./lib/config";

export default async function (params: Record<string, unknown>) {
  try {
    const neo4j = getNeo4jService();

    // Test connection with simple query
    const testResult = await neo4j.executeCypher("RETURN 1 as test", {}, "READ");
    const connected = testResult.length > 0;

    // Get node count
    const countResult = await neo4j.executeCypher(
      "MATCH (n) RETURN count(n) as count",
      {},
      "READ"
    );
    const nodeCount = countResult[0]?.count || 0;

    return {
      service: "memory",
      healthy: connected,
      neo4j: {
        connected,
        url: process.env.NEO4J_URI || "bolt://localhost:7687"
      },
      graph: {
        node_count: Number(nodeCount)
      }
    };
  } catch (error) {
    console.error("[memory/system_status] Error:", error);
    return {
      service: "memory",
      healthy: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
