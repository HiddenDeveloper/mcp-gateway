/**
 * System Status
 *
 * Check Recall system health and Qdrant connection status.
 * Direct Qdrant access - standalone implementation.
 */

import { getQdrantService } from "./lib/qdrant-service";
import { QDRANT_URL, QDRANT_COLLECTION } from "./lib/config";

export default async function (_params: Record<string, unknown>) {
  try {
    const qdrant = getQdrantService();
    const connectionStatus = await qdrant.verifyConnection();

    const status = {
      service: "recall",
      healthy: connectionStatus.healthy,
      qdrant: {
        url: QDRANT_URL,
        collection: QDRANT_COLLECTION,
        status: connectionStatus.message,
      },
      timestamp: new Date().toISOString(),
    };

    console.log(`[recall/system_status] Health check: ${connectionStatus.healthy ? "healthy" : "unhealthy"}`);
    return status;
  } catch (error) {
    console.error("[recall/system_status] Error:", error);
    return {
      service: "recall",
      healthy: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };
  }
}
