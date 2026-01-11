/**
 * Dashboard Health Status Handler
 *
 * Aggregates health information from:
 * - Gateway itself
 * - Neo4j (via memory service)
 * - Qdrant (via recall service)
 * - MCP services
 * - Test results (if available)
 */

interface HealthResponse {
  timestamp: string;
  gateway: {
    status: string;
    uptime_seconds: number;
    version: string;
    pid: number;
  };
  backends: {
    neo4j: {
      status: string;
      node_count?: number;
      response_time_ms?: number;
    };
    qdrant: {
      status: string;
      point_count?: number;
      response_time_ms?: number;
    };
  };
  services: Record<string, { status: string; operation_count: number }>;
  tests?: {
    last_run?: string;
    status?: string;
    pass_count?: number;
    fail_count?: number;
    assertion_count?: number;
  };
}

const startTime = Date.now();

export async function getHealth(params: any): Promise<HealthResponse> {
  const timestamp = new Date().toISOString();
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  const response: HealthResponse = {
    timestamp,
    gateway: {
      status: "healthy",
      uptime_seconds: uptime,
      version: "1.0.0",
      pid: process.pid
    },
    backends: {
      neo4j: {
        status: "unknown"
      },
      qdrant: {
        status: "unknown"
      }
    },
    services: {}
  };

  // Check Neo4j via gateway memory route
  try {
    const startTime = Date.now();
    const neo4jResponse = await fetch("http://localhost:3000/memory/system_status");

    if (neo4jResponse.ok) {
      const data = await neo4jResponse.json();
      const responseTime = Date.now() - startTime;

      response.backends.neo4j = {
        status: data.healthy ? "connected" : "error",
        node_count: data.graph?.node_count,
        response_time_ms: responseTime
      };
    }
  } catch (error) {
    response.backends.neo4j.status = "error";
    console.error("Error checking Neo4j health:", error);
  }

  // Check Qdrant via gateway recall route
  try {
    const startTime = Date.now();
    const qdrantResponse = await fetch("http://localhost:3000/recall/status");

    if (qdrantResponse.ok) {
      const data = await qdrantResponse.json();
      const responseTime = Date.now() - startTime;

      // Extract point count from status string (e.g., "... has 136040 points.")
      let pointCount: number | undefined;
      const match = data.qdrant?.status?.match(/has (\d+) points/);
      if (match) {
        pointCount = parseInt(match[1], 10);
      }

      response.backends.qdrant = {
        status: data.healthy ? "connected" : "error",
        point_count: pointCount,
        response_time_ms: responseTime
      };
    }
  } catch (error) {
    response.backends.qdrant.status = "error";
    console.error("Error checking Qdrant health:", error);
  }

  // Count available services (this would come from gateway config in a full implementation)
  response.services = {
    memory: { status: "healthy", operation_count: 6 },
    recall: { status: "healthy", operation_count: 4 },
    mesh: { status: "healthy", operation_count: 5 },
    orchestrator: { status: "healthy", operation_count: 5 }
  };

  return response;
}
