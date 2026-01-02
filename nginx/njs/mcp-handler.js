/**
 * MCP Gateway Handler for NGINX njs
 * 
 * This module handles all MCP protocol translation:
 * - Parse incoming JSON-RPC requests
 * - Route to appropriate backend endpoints
 * - Transform responses to MCP format
 * - Handle tool discovery
 */

// Tool registry loaded from config
var toolRegistry = null;
var routingConfig = null;

/**
 * Initialize the handler with tool configuration
 * Called once on NGINX startup
 */
function init(r) {
    try {
        // Load tool configuration from file
        // UPDATE THIS PATH to match your installation
        var configPath = '/Users/monyet/develop/home/nginx-mcp-gateway/config/tools.json';
        var configData = require('fs').readFileSync(configPath);
        var config = JSON.parse(configData);
        
        toolRegistry = {};
        config.tools.forEach(function(tool) {
            toolRegistry[tool.name] = tool;
        });
        
        routingConfig = config.routing || {};
        
        r.return(200, JSON.stringify({ status: 'initialized', tools: Object.keys(toolRegistry).length }));
    } catch (e) {
        r.return(500, JSON.stringify({ error: 'Failed to initialize: ' + e.message }));
    }
}

/**
 * Main MCP request handler
 * Entry point for all MCP traffic
 */
function handleMCPRequest(r) {
    // Read request body
    var body = r.requestText;
    
    if (!body) {
        return mcpError(r, -32700, 'Parse error: empty request body', null);
    }
    
    var request;
    try {
        request = JSON.parse(body);
    } catch (e) {
        return mcpError(r, -32700, 'Parse error: invalid JSON', null);
    }
    
    // Validate JSON-RPC structure
    if (request.jsonrpc !== '2.0') {
        return mcpError(r, -32600, 'Invalid Request: must be JSON-RPC 2.0', request.id);
    }
    
    // Route based on method
    switch (request.method) {
        case 'initialize':
            return handleInitialize(r, request);
        case 'tools/list':
            return handleToolsList(r, request);
        case 'tools/call':
            return handleToolCall(r, request);
        case 'ping':
            return handlePing(r, request);
        default:
            return mcpError(r, -32601, 'Method not found: ' + request.method, request.id);
    }
}

/**
 * Handle MCP initialize request
 */
function handleInitialize(r, request) {
    var response = {
        jsonrpc: '2.0',
        result: {
            protocolVersion: '2024-11-05',
            capabilities: {
                tools: {}
            },
            serverInfo: {
                name: 'nginx-mcp-gateway',
                version: '1.0.0'
            }
        },
        id: request.id
    };
    
    r.headersOut['Content-Type'] = 'application/json';
    r.return(200, JSON.stringify(response));
}

/**
 * Handle tools/list request
 * Returns all available tools from registry
 */
function handleToolsList(r, request) {
    var tools = [];
    
    for (var name in toolRegistry) {
        var tool = toolRegistry[name];
        tools.push({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
        });
    }
    
    var response = {
        jsonrpc: '2.0',
        result: {
            tools: tools
        },
        id: request.id
    };
    
    r.headersOut['Content-Type'] = 'application/json';
    r.return(200, JSON.stringify(response));
}

/**
 * Handle tools/call request
 * Routes to backend and transforms response
 */
function handleToolCall(r, request) {
    var params = request.params || {};
    var toolName = params.name;
    var args = params.arguments || {};
    
    if (!toolName) {
        return mcpError(r, -32602, 'Invalid params: missing tool name', request.id);
    }
    
    var tool = toolRegistry[toolName];
    if (!tool) {
        return mcpError(r, -32602, 'Unknown tool: ' + toolName, request.id);
    }
    
    // Determine backend URL
    var backendUrl = resolveBackend(tool);
    var endpoint = tool.backend.endpoint;
    var method = tool.backend.method || 'POST';
    
    // Store request context for callback
    r.variables.mcp_request_id = request.id;
    r.variables.mcp_tool_name = toolName;
    
    // Make subrequest to backend
    var options = {
        method: method,
        body: method !== 'GET' ? JSON.stringify(args) : undefined
    };
    
    // For GET requests, convert args to query string
    if (method === 'GET' && Object.keys(args).length > 0) {
        var queryParams = [];
        for (var key in args) {
            queryParams.push(encodeURIComponent(key) + '=' + encodeURIComponent(args[key]));
        }
        endpoint += '?' + queryParams.join('&');
    }
    
    r.subrequest('/backend' + endpoint, options, function(reply) {
        handleBackendResponse(r, request, tool, reply);
    });
}

/**
 * Handle backend response and transform to MCP format
 */
function handleBackendResponse(r, mcpRequest, tool, backendReply) {
    var responseBody;
    
    if (backendReply.status >= 400) {
        // Backend error - wrap in MCP error
        return mcpError(r, -32000, 'Backend error: ' + backendReply.status, mcpRequest.id);
    }
    
    try {
        // Try to parse as JSON
        responseBody = JSON.parse(backendReply.responseText);
    } catch (e) {
        // Use raw text if not JSON
        responseBody = backendReply.responseText;
    }
    
    // Build MCP response
    var content;
    if (tool.transform && tool.transform.wrap_text) {
        // Wrap response in text content block
        content = [{
            type: 'text',
            text: typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)
        }];
    } else {
        // Default: wrap in text block
        content = [{
            type: 'text',
            text: JSON.stringify(responseBody)
        }];
    }
    
    var response = {
        jsonrpc: '2.0',
        result: {
            content: content,
            isError: false
        },
        id: mcpRequest.id
    };
    
    r.headersOut['Content-Type'] = 'application/json';
    r.return(200, JSON.stringify(response));
}

/**
 * Handle ping request
 */
function handlePing(r, request) {
    var response = {
        jsonrpc: '2.0',
        result: {},
        id: request.id
    };
    
    r.headersOut['Content-Type'] = 'application/json';
    r.return(200, JSON.stringify(response));
}

/**
 * Resolve backend URL for a tool
 */
function resolveBackend(tool) {
    // Check if tool has explicit backend host
    if (tool.backend && tool.backend.host) {
        return tool.backend.host;
    }
    
    // Check routing prefixes
    if (routingConfig.prefixes) {
        for (var prefix in routingConfig.prefixes) {
            if (tool.name.startsWith(prefix)) {
                return routingConfig.prefixes[prefix];
            }
        }
    }
    
    // Use default
    return routingConfig.default || 'http://localhost:8080';
}

/**
 * Send MCP error response
 */
function mcpError(r, code, message, id) {
    var response = {
        jsonrpc: '2.0',
        error: {
            code: code,
            message: message
        },
        id: id
    };
    
    r.headersOut['Content-Type'] = 'application/json';
    r.return(200, JSON.stringify(response));
}

/**
 * SSE endpoint for streaming responses
 * Used for Streamable HTTP transport
 */
function handleSSE(r) {
    r.headersOut['Content-Type'] = 'text/event-stream';
    r.headersOut['Cache-Control'] = 'no-cache';
    r.headersOut['Connection'] = 'keep-alive';
    
    // Send initial connection event
    r.sendBuffer('event: open\ndata: {"connected":true}\n\n');
    
    // Keep connection alive
    // Actual message streaming would be handled by backend
}

// Export functions for NGINX
export default { init, handleMCPRequest, handleSSE };
