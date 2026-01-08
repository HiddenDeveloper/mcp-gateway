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
    const testResult = await neo4j.executeQuery("RETURN 1 as test");
    const connected = testResult.records.length > 0;

    // Get node count
    const countResult = await neo4j.executeQuery(
      "MATCH (n) RETURN count(n) as count"
    );
    const nodeCount = countResult.records[0]?.get('count') || 0;

    return {
      service: "memory",
      healthy: connected,
      neo4j: {
        connected,
        url: process.env.NEO4J_URL || "bolt://localhost:7687"
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
