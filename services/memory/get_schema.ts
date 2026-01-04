/**
 * Get Schema
 *
 * Returns the Neo4j database schema with optional statistics.
 */

import { getNeo4jService, config } from "./lib/config";

interface Params {
  include_statistics?: boolean;
}

export default async function(params: Record<string, unknown>) {
  const { include_statistics = false } = params as Params;

  const service = getNeo4jService();

  try {
    await service.verifyConnection();

    const schema = await service.getSchema(config.neo4j.database);
    const schemaEpoch = await service.getOrInitSchemaEpoch(config.neo4j.database);

    const result: Record<string, unknown> = {
      labels: schema.labels,
      relationshipTypes: schema.relationshipTypes,
      schemaEpoch,
    };

    if (include_statistics) {
      // Get node counts per label
      const nodeCounts: Record<string, number> = {};
      for (const label of schema.labels) {
        try {
          const countResult = await service.executeCypher(
            `MATCH (n:\`${label}\`) RETURN count(n) as count`,
            {},
            "READ",
            config.neo4j.database
          );
          nodeCounts[label] = countResult[0]?.count?.toNumber?.() || countResult[0]?.count || 0;
        } catch {
          nodeCounts[label] = -1;
        }
      }

      // Get relationship counts per type
      const relCounts: Record<string, number> = {};
      for (const relType of schema.relationshipTypes) {
        try {
          const countResult = await service.executeCypher(
            `MATCH ()-[r:\`${relType}\`]->() RETURN count(r) as count`,
            {},
            "READ",
            config.neo4j.database
          );
          relCounts[relType] = countResult[0]?.count?.toNumber?.() || countResult[0]?.count || 0;
        } catch {
          relCounts[relType] = -1;
        }
      }

      result.statistics = {
        nodeCounts,
        relationshipCounts: relCounts,
        totalLabels: schema.labels.length,
        totalRelationshipTypes: schema.relationshipTypes.length,
      };
    }

    return result;
  } catch (error) {
    console.error("[get_schema] Error:", error);
    throw error;
  }
}
