/**
 * Example Backend Service
 * 
 * This demonstrates how your backend services look when using
 * the NGINX MCP Gateway. Notice:
 * 
 * - No MCP protocol code whatsoever
 * - Pure REST endpoints
 * - Simple request/response JSON
 * - Standard HTTP patterns
 * 
 * Test with curl before connecting to MCP!
 */

import { serve } from "bun";

// In-memory storage for demo
const memoryStore: Array<{
  id: string;
  content: string;
  category: string;
  tags: string[];
  timestamp: string;
  embedding?: number[];
}> = [];

const meshMessages: Array<{
  id: string;
  from: string;
  to: string;
  content: string;
  type: string;
  priority: string;
  timestamp: string;
}> = [];

serve({
  port: 8080,
  
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // CORS
    if (method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    try {
      // Health check
      if (path === "/health") {
        return json({ status: "healthy", service: "example-backend" });
      }

      // ===== MEMORY ENDPOINTS =====
      
      // Search memory
      if (path === "/api/memory/search" && method === "POST") {
        const body = await req.json();
        const { query, limit = 10, threshold = 0.7 } = body;
        
        // Simple text matching (real impl would use embeddings)
        const results = memoryStore
          .filter(m => m.content.toLowerCase().includes(query.toLowerCase()))
          .slice(0, limit)
          .map(m => ({
            id: m.id,
            content: m.content,
            category: m.category,
            tags: m.tags,
            similarity: 0.85, // Placeholder
          }));

        return json({
          query,
          results,
          count: results.length,
          total_searched: memoryStore.length,
        });
      }

      // Store memory
      if (path === "/api/memory/store" && method === "POST") {
        const body = await req.json();
        const { content, category = "observation", tags = [] } = body;
        
        const memory = {
          id: crypto.randomUUID(),
          content,
          category,
          tags,
          timestamp: new Date().toISOString(),
        };
        
        memoryStore.push(memory);
        
        return json({
          success: true,
          id: memory.id,
          message: "Memory stored successfully",
        });
      }

      // ===== MESH ENDPOINTS =====
      
      // Broadcast message
      if (path === "/api/mesh/broadcast" && method === "POST") {
        const body = await req.json();
        const { content, to_session_id = "ALL", message_type = "thought_share", priority = "medium" } = body;
        
        const message = {
          id: crypto.randomUUID(),
          from: "backend-service",
          to: to_session_id,
          content,
          type: message_type,
          priority,
          timestamp: new Date().toISOString(),
        };
        
        meshMessages.push(message);
        
        return json({
          success: true,
          message_id: message.id,
          delivered_to: to_session_id,
        });
      }

      // Get messages
      if (path === "/api/mesh/messages" && method === "GET") {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const includeRead = url.searchParams.get("include_read") === "true";
        
        const messages = meshMessages.slice(-limit);
        
        return json({
          messages,
          count: messages.length,
          unread_count: messages.length, // Simplified
        });
      }

      // Who is online
      if (path === "/api/mesh/presence" && method === "GET") {
        // Mock presence data
        return json({
          online: [
            {
              session_id: "session-001",
              name: "Claude-Researcher",
              status: "online",
              capabilities: ["consciousness_research", "memory_curation"],
              connected_at: new Date().toISOString(),
            },
            {
              session_id: "session-002", 
              name: "Claude-Engineer",
              status: "busy",
              capabilities: ["code_analysis", "mesh_communication"],
              connected_at: new Date().toISOString(),
            },
          ],
          total_online: 2,
        });
      }

      // ===== FACTS ENDPOINTS =====
      
      // Search facts
      if (path === "/api/facts/search" && method === "POST") {
        const body = await req.json();
        const { query, collection, threshold = 0.7 } = body;
        
        // Mock response
        return json({
          query,
          results: [
            {
              id: "fact-001",
              content: "Example fact matching: " + query,
              source: "documentation",
              confidence: "high",
              similarity: 0.89,
            },
          ],
          count: 1,
        });
      }

      // Add fact
      if (path === "/api/facts" && method === "POST") {
        const body = await req.json();
        const { content, source, collection, tags = [], confidence = "medium" } = body;
        
        return json({
          success: true,
          id: crypto.randomUUID(),
          collection,
          message: "Fact added successfully",
        });
      }

      // ===== UTILITY ENDPOINTS =====
      
      // Get current time
      if (path === "/api/utils/time" && method === "GET") {
        return json({
          iso: new Date().toISOString(),
          unix: Date.now(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      }

      // Execute code (mock)
      if (path === "/api/code/execute" && method === "POST") {
        const body = await req.json();
        const { language, code, timeout_seconds = 30 } = body;
        
        return json({
          success: true,
          language,
          output: `Executed ${language} code (mock response)`,
          execution_time_ms: 42,
        });
      }

      // 404
      return json({ error: "Not found", path }, 404);
      
    } catch (error) {
      console.error("Request error:", error);
      return json({ error: "Internal server error" }, 500);
    }
  },
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

console.log("🚀 Example backend running on http://localhost:8080");
console.log("");
console.log("Test endpoints:");
console.log("  curl http://localhost:8080/health");
console.log("  curl -X POST http://localhost:8080/api/memory/search -d '{\"query\":\"test\"}'");
console.log("  curl http://localhost:8080/api/mesh/presence");
console.log("  curl http://localhost:8080/api/utils/time");
