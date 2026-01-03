#!/bin/bash
# Start the nginx-memory backend with real Neo4j integration
# This backend replaces ai-memory-mcp with pure HTTP/REST endpoints

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment from Stone Monkey native environment if available
if [ -f "/Users/monyet/develop/home/ProjectStoneMonkey/.env.native" ]; then
    source /Users/monyet/develop/home/ProjectStoneMonkey/.env.native
    echo "✓ Loaded .env.native"
fi

# Required: Embedding service auth token
if [ -z "$EMBEDDING_SERVICE_AUTH_TOKEN" ]; then
    echo "⚠ Warning: EMBEDDING_SERVICE_AUTH_TOKEN not set - semantic search will fail"
fi

# Default Neo4j configuration
export NEO4J_URI="${NEO4J_URI:-bolt://localhost:7687}"
export NEO4J_USER="${NEO4J_USER:-neo4j}"
export NEO4J_DATABASE="${NEO4J_DATABASE:-neo4j}"
export EMBEDDING_SERVICE_URL="${EMBEDDING_SERVICE_URL:-http://localhost:3007}"

echo "Starting nginx-memory backend..."
echo "  Port: 5001"
echo "  Neo4j: $NEO4J_URI"
echo "  Database: $NEO4J_DATABASE"
echo "  Embedding: $EMBEDDING_SERVICE_URL"
echo ""

cd "$PROJECT_DIR"
exec bun run examples/backend-service.ts
