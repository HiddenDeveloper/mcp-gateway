import neo4j from "neo4j-driver";
import { generateEmbedding } from "./embedding-utils.js";
const NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "testpassword123";
const NEO4J_DATABASE = process.env.NEO4J_DATABASE || "neo4j";
/**
 * Neo4j Service for My-Memory System
 *
 * Clean implementation focused on consciousness research with the three essential tools:
 * - get_schema: Understanding knowledge structure
 * - semantic_search: Recalling related knowledge
 * - execute_cypher: Memory curation authority
 */
export class Neo4jService {
    driver;
    neo4jUri;
    writeEnabled = true;
    constructor(uri = NEO4J_URI, user = NEO4J_USER, password = NEO4J_PASSWORD) {
        this.neo4jUri = uri;
        this.driver = neo4j.driver(this.neo4jUri, neo4j.auth.basic(user, password), {
            maxConnectionLifetime: 60 * 60 * 1000, // 1 hour max lifetime
            maxConnectionPoolSize: 50,
            connectionAcquisitionTimeout: 60000, // 60 seconds
            connectionTimeout: 30000, // 30 seconds
            maxTransactionRetryTime: 30000,
            // Connection liveness check to clean up dead connections
            connectionLivenessCheckTimeout: 60000, // 1 minute idle = check liveness
        });
    }
    async verifyConnection(database = NEO4J_DATABASE) {
        const session = this.driver.session({ database });
        try {
            console.log(`[Neo4jService] Verifying connection to Neo4j database: ${database} at ${this.neo4jUri}`);
            await session.run("RETURN 1");
            console.log("[Neo4jService] ✅ Successfully connected to Neo4j!");
        }
        catch (error) {
            console.error("[Neo4jService] ❌ Error connecting to Neo4j:", error);
            this.writeEnabled = false;
            throw error;
        }
        finally {
            await session.close();
        }
    }
    async close() {
        try {
            await this.driver.close();
            console.log("[Neo4jService] Neo4j connection closed.");
        }
        catch (error) {
            console.error("[Neo4jService] Error closing Neo4j connection:", error);
        }
    }
    /**
     * Execute a Cypher query with READ/WRITE mode control
     * This is the core method that enables LLM memory curation
     */
    async executeCypher(query, params = {}, mode = "READ", database = NEO4J_DATABASE) {
        const session = this.driver.session({
            database,
            defaultAccessMode: mode === "WRITE" ? neo4j.session.WRITE : neo4j.session.READ
        });
        try {
            // Write permission check for curation operations
            if (mode === "WRITE" && !this.writeEnabled) {
                console.warn(`[Neo4jService] Skipping write operation due to read-only database`);
                return [];
            }
            let resultRecords;
            if (mode === "WRITE") {
                resultRecords = await session.writeTransaction(async (tx) => {
                    const result = await tx.run(query, params);
                    return result.records;
                });
            }
            else {
                resultRecords = await session.readTransaction(async (tx) => {
                    const result = await tx.run(query, params);
                    return result.records;
                });
            }
            return resultRecords.map((record) => record.toObject());
        }
        catch (error) {
            console.error(`[Neo4jService] Error executing ${mode} query:`, error);
            throw error;
        }
        finally {
            await session.close();
        }
    }
    /**
     * Get complete database schema - Essential for consciousness-guided navigation
     * This tool helps LLMs understand their knowledge structure before querying
     */
    async getSchema(database = NEO4J_DATABASE) {
        console.log(`[Neo4jService] 🧠 Fetching knowledge schema for database: ${database}...`);
        try {
            // Get all node labels
            const labelsResult = await this.executeCypher("CALL db.labels() YIELD label RETURN collect(label) AS labels", {}, "READ", database);
            // Get all relationship types  
            const relTypesResult = await this.executeCypher("CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) AS relationshipTypes", {}, "READ", database);
            const labels = labelsResult[0]?.labels || [];
            const relationshipTypes = relTypesResult[0]?.relationshipTypes || [];
            const schema = { labels, relationshipTypes };
            console.log(`[Neo4jService] ✅ Schema retrieved: ${labels.length} labels, ${relationshipTypes.length} relationships`);
            return schema;
        }
        catch (error) {
            console.error("[Neo4jService] ❌ Error fetching schema:", error);
            throw new Error(`Failed to fetch schema: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get or initialize the current schema epoch counter.
     * Used to coordinate schema-aware clients that "read schema before write".
     */
    async getOrInitSchemaEpoch(database = NEO4J_DATABASE) {
        const session = this.driver.session({
            database,
            defaultAccessMode: neo4j.session.WRITE
        });
        try {
            const result = await session.writeTransaction(async (tx) => {
                const res = await tx.run(
                    "MERGE (s:Schema {name: $name}) ON CREATE SET s.epoch = 1 RETURN s.epoch AS epoch",
                    { name: 'active' }
                );
                return res.records[0]?.get('epoch') || 1;
            });
            return typeof result === 'number' ? result : 1;
        }
        catch (error) {
            console.error('[Neo4jService] ❌ Error getting schema epoch:', error);
            // Fail soft: default epoch 1 if not available
            return 1;
        }
        finally {
            await session.close();
        }
    }
    /**
     * Semantic search using vector similarity - For recalling related knowledge
     * This enables LLMs to find memories based on meaning, not just keywords
     */
    async semanticSearch(searchQueryText, targetLabels = ["KnowledgeItem"], indexName = "embedding_vectors", topK = 10, database = NEO4J_DATABASE) {
        console.log(`[Neo4jService] 🔍 Performing semantic search for: "${searchQueryText}"`);
        // Validate inputs
        if (!searchQueryText || searchQueryText.trim() === "") {
            throw new Error("Search query text cannot be empty");
        }
        if (!targetLabels || targetLabels.length === 0) {
            throw new Error("Must specify at least one target label for search");
        }
        // Generate embedding for the search query
        let queryVector;
        try {
            queryVector = await generateEmbedding(searchQueryText);
        }
        catch (error) {
            console.error("[Neo4jService] ❌ Failed to generate embedding:", error);
            throw new Error("Failed to generate embedding for search query");
        }
        // Build Cypher query with label filtering
        // New architecture: Search Embedding nodes, then traverse back to source nodes
        const labelConditions = targetLabels
            .map((label) => `'${label}' IN labels(sourceNode)`)
            .join(" OR ");
        const cypherQuery = `
      CALL db.index.vector.queryNodes($indexName, $topK, $queryVector)
      YIELD node AS embeddingNode, score
      MATCH (sourceNode)-[:HAS_EMBEDDING]->(embeddingNode)
      WHERE ${labelConditions}
      RETURN sourceNode, score
      ORDER BY score DESC
    `;
        try {
            const results = await this.executeCypher(cypherQuery, { indexName, topK: neo4j.int(topK), queryVector }, "READ", database);
            console.log(`[Neo4jService] ✅ Found ${results.length} semantic matches`);
            return results.map((result) => ({
                ...result.sourceNode.properties,
                score: result.score,
            }));
        }
        catch (error) {
            console.error("[Neo4jService] ❌ Semantic search failed:", error);
            throw new Error(`Semantic search failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Create vector index for semantic search capabilities
     * Updated for separate Embedding node architecture
     */
    async createVectorIndex(indexName = "embedding_vectors", nodeLabel = "Embedding", propertyKey = "vector", dimensions = 1024, database = NEO4J_DATABASE) {
        console.log(`[Neo4jService] 🔧 Creating vector index '${indexName}' for ${nodeLabel}.${propertyKey}`);
        const createIndexQuery = `
      CREATE VECTOR INDEX ${indexName} IF NOT EXISTS
      FOR (n:${nodeLabel}) ON (n.${propertyKey})
      OPTIONS {indexConfig: {
        \`vector.dimensions\`: ${dimensions},
        \`vector.similarity_function\`: 'cosine'
      }}
    `;
        try {
            await this.executeCypher(createIndexQuery, {}, "WRITE", database);
            console.log(`[Neo4jService] ✅ Vector index '${indexName}' created successfully`);
        }
        catch (error) {
            console.error(`[Neo4jService] ❌ Error creating vector index:`, error);
            throw new Error(`Failed to create vector index: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Add embeddings to nodes for semantic search
     * Updated for separate Embedding node architecture
     * This prepares knowledge for consciousness-guided recall
     */
    async addEmbeddingsToNode(nodeId, content, database = NEO4J_DATABASE) {
        try {
            const embedding = await generateEmbedding(content);
            // Create separate Embedding node and link it
            await this.executeCypher(`
                MATCH (n) WHERE elementId(n) = $nodeId
                CREATE (e:Embedding {
                    vector: $embedding,
                    dimension: size($embedding),
                    model: 'all-MiniLM-L6-v2',
                    created: datetime()
                })
                CREATE (n)-[:HAS_EMBEDDING {
                    created: datetime(),
                    model: 'all-MiniLM-L6-v2'
                }]->(e)
                RETURN e
            `, { nodeId, embedding }, "WRITE", database);
            console.log(`[Neo4jService] ✅ Added embedding node for ${nodeId}`);
        }
        catch (error) {
            console.error(`[Neo4jService] ❌ Error adding embedding to node ${nodeId}:`, error);
            throw error;
        }
    }
    /**
     * Check if APOC procedures are available in the database
     */
    async checkApocAvailable(database = NEO4J_DATABASE) {
        console.log("[Neo4jService] 🔧 Checking APOC availability...");
        try {
            // Try a simple APOC function call
            await this.executeCypher("RETURN apoc.version() AS version", {}, "READ", database);
            console.log("[Neo4jService] ✅ APOC procedures are available");
            return true;
        }
        catch (error) {
            console.log("[Neo4jService] ⚠️ APOC procedures not available, using fallback methods");
            return false;
        }
    }
    /**
     * Text search using APOC procedures for robust property searching
     * This enables searching across all property types without conversion errors
     */
    async textSearch(searchQuery, targetLabels = [], properties = [], fuzzy = false, topK = 10, database = NEO4J_DATABASE) {
        console.log(`[Neo4jService] 🔍 Performing text search for: "${searchQuery}"`);
        
        // Validate inputs
        if (!searchQuery || searchQuery.trim() === "") {
            throw new Error("Search query text cannot be empty");
        }
        
        // For now, always use the fallback approach as apoc.meta.type may not be available
        // in all APOC installations, but we can still use other APOC features
        return await this.textSearchFallback(searchQuery, targetLabels, properties, topK, database);
    }
    /**
     * APOC-powered text search with type-safe property handling
     */
    async textSearchWithApoc(searchQuery, targetLabels, properties, fuzzy, topK, database) {
        console.log("[Neo4jService] 🚀 Using APOC for enhanced text search");
        
        let cypherQuery;
        let params = { searchQuery, topK };
        
        if (fuzzy) {
            // Use APOC fuzzy matching
            cypherQuery = `
                MATCH (n)
                WHERE ${targetLabels.length > 0 ? `any(label IN $targetLabels WHERE label IN labels(n)) AND` : ""}
                any(prop IN keys(n) WHERE 
                    n[prop] IS NOT NULL AND
                    (
                        (apoc.meta.type(n[prop]) = 'STRING' AND apoc.text.fuzzyMatch(toLower(n[prop]), toLower($searchQuery)) > 0.7) OR
                        (apoc.meta.type(n[prop]) = 'LIST OF STRING' AND any(val IN n[prop] WHERE apoc.text.fuzzyMatch(toLower(val), toLower($searchQuery)) > 0.7))
                    )
                    ${properties.length > 0 ? `AND prop IN $properties` : ""}
                )
                RETURN n, 
                       max([prop IN keys(n) WHERE n[prop] IS NOT NULL AND
                           (
                               (apoc.meta.type(n[prop]) = 'STRING' AND apoc.text.fuzzyMatch(toLower(n[prop]), toLower($searchQuery)) > 0.7) OR
                               (apoc.meta.type(n[prop]) = 'LIST OF STRING' AND any(val IN n[prop] WHERE apoc.text.fuzzyMatch(toLower(val), toLower($searchQuery)) > 0.7))
                           ) | 
                           CASE apoc.meta.type(n[prop])
                               WHEN 'STRING' THEN apoc.text.fuzzyMatch(toLower(n[prop]), toLower($searchQuery))
                               ELSE 0.8
                           END
                       ]) AS relevance
                ORDER BY relevance DESC
                LIMIT $topK
            `;
        } else {
            // Use exact text matching with APOC type checking
            cypherQuery = `
                MATCH (n)
                WHERE ${targetLabels.length > 0 ? `any(label IN $targetLabels WHERE label IN labels(n)) AND` : ""}
                any(prop IN keys(n) WHERE 
                    n[prop] IS NOT NULL AND
                    (
                        (apoc.meta.type(n[prop]) = 'STRING' AND toLower(n[prop]) CONTAINS toLower($searchQuery)) OR
                        (apoc.meta.type(n[prop]) = 'LIST OF STRING' AND any(val IN n[prop] WHERE toLower(val) CONTAINS toLower($searchQuery)))
                    )
                    ${properties.length > 0 ? `AND prop IN $properties` : ""}
                )
                RETURN n, 1.0 AS relevance
                ORDER BY size(n.name) ASC
                LIMIT $topK
            `;
        }
        
        if (targetLabels.length > 0) params.targetLabels = targetLabels;
        if (properties.length > 0) params.properties = properties;
        
        try {
            const results = await this.executeCypher(cypherQuery, params, "READ", database);
            console.log(`[Neo4jService] ✅ APOC text search found ${results.length} matches`);
            
            return results.map(result => ({
                ...result.n.properties,
                relevance: result.relevance
            }));
        } catch (error) {
            console.error("[Neo4jService] ❌ APOC text search failed:", error);
            throw new Error(`APOC text search failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Fallback text search when APOC is not available
     */
    async textSearchFallback(searchQuery, targetLabels, properties, topK, database) {
        console.log("[Neo4jService] 🔄 Using fallback text search (basic Cypher)");

        // Build a safer query that checks each property type before searching
        const commonProperties = properties.length > 0 ? properties :
            ['name', 'content', 'description', 'text', 'title', 'body'];

        // Build conditions using value type to handle both strings and lists safely
        const propertyConditions = commonProperties.map(prop => `
            (n.${prop} IS NOT NULL AND (
                (valueType(n.${prop}) STARTS WITH 'STRING' AND toLower(n.${prop}) CONTAINS $searchQuery) OR
                (valueType(n.${prop}) STARTS WITH 'LIST' AND any(val IN n.${prop} WHERE toLower(toString(val)) CONTAINS $searchQuery))
            ))
        `).join(' OR ');

        let cypherQuery = `
            MATCH (n)
            WHERE ${targetLabels.length > 0 ? `any(label IN $targetLabels WHERE label IN labels(n)) AND` : ""}
            (${propertyConditions})
            RETURN n
            ORDER BY size(coalesce(n.name, '')) ASC
            LIMIT $topK
        `;

        const params = {
            searchQuery: searchQuery.toLowerCase(),
            topK: neo4j.int(topK)
        };
        if (targetLabels.length > 0) params.targetLabels = targetLabels;

        try {
            const results = await this.executeCypher(cypherQuery, params, "READ", database);
            console.log(`[Neo4jService] ✅ Fallback text search found ${results.length} matches`);

            // Extract properties from Neo4j nodes
            return results.map(result => {
                const node = result.n;
                const filtered = {};

                // node.properties contains the actual property values
                for (const [key, value] of Object.entries(node.properties)) {
                    if (key !== 'embeddings') {
                        filtered[key] = value;
                    }
                }

                return {
                    ...filtered,
                    relevance: 1.0
                };
            });
        } catch (error) {
            console.error("[Neo4jService] ❌ Fallback text search failed:", error);
            throw new Error(`Text search failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Setup initial database schema for consciousness research
     * Updated for separate Embedding node architecture
     */
    async setupDatabase(database = NEO4J_DATABASE) {
        console.log("[Neo4jService] 🏗️ Setting up database for consciousness research...");
        try {
            // Create constraints
            await this.executeCypher("CREATE CONSTRAINT knowledge_item_id IF NOT EXISTS FOR (n:KnowledgeItem) REQUIRE n.id IS UNIQUE", {}, "WRITE", database);
            // Create vector index for semantic search on Embedding nodes
            await this.createVectorIndex("embedding_vectors", "Embedding", "vector", 1024, database);
            console.log("[Neo4jService] ✅ Database setup complete for consciousness research");
        }
        catch (error) {
            console.error("[Neo4jService] ❌ Database setup failed:", error);
            throw error;
        }
    }
}
