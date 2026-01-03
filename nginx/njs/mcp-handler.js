/**
 * MCP Gateway Handler for NGINX njs
 * 
 * This module handles all MCP protocol translation:
 * - Parse incoming JSON-RPC requests
 * - Route to appropriate backend endpoints
 * - Transform responses to MCP format
 * - Handle tool discovery
 */

// Tool registry - loaded on each request (njs doesn't persist global state between requests)
var toolRegistry = null;
var routingConfig = null;
var serverConfig = null;
var categoriesConfig = null;

// Config path - set via nginx variable $mcp_config_path or fallback to relative path
var CONFIG_PATH = null;

/**
 * Structured logging for observability
 * Logs JSON to nginx error log at info level
 */
function logEvent(r, event, data) {
    var entry = {
        ts: new Date().toISOString(),
        event: event,
        method: r.method,
        uri: r.uri
    };
    // Merge additional data
    for (var key in data) {
        entry[key] = data[key];
    }
    r.log(JSON.stringify(entry));
}

/**
 * Get config path from nginx variable or use default
 */
function getConfigPath(r) {
    // Try nginx variable first (set via js_var or set directive)
    if (r && r.variables && r.variables.mcp_config_path) {
        return r.variables.mcp_config_path;
    }
    // Fallback to cached path or default
    return CONFIG_PATH || '/etc/nginx/mcp-gateway/tools.json';
}

/**
 * Ensure tool registry is loaded
 * Called automatically before handling requests
 */
function ensureLoaded(r) {
    if (toolRegistry !== null) {
        return true;
    }
    try {
        var configPath = getConfigPath(r);
        var configData = require('fs').readFileSync(configPath);
        var config = JSON.parse(configData);

        toolRegistry = {};
        config.tools.forEach(function(tool) {
            toolRegistry[tool.name] = tool;
        });

        routingConfig = config.routing || {};
        serverConfig = config.server || {};
        categoriesConfig = config.categories || [];
        CONFIG_PATH = configPath; // Cache for subsequent calls
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Initialize the handler with tool configuration
 * Called via /init endpoint to verify config is valid
 */
function init(r) {
    // Force reload
    toolRegistry = null;
    routingConfig = null;
    CONFIG_PATH = null;

    if (ensureLoaded(r)) {
        r.return(200, JSON.stringify({ status: 'initialized', tools: Object.keys(toolRegistry).length, config: CONFIG_PATH }));
    } else {
        r.return(500, JSON.stringify({ error: 'Failed to load config from ' + getConfigPath(r) }));
    }
}

/**
 * Main MCP request handler
 * Entry point for all MCP traffic
 */
function handleMCPRequest(r) {
    // Ensure config is loaded (njs doesn't persist globals between requests)
    if (!ensureLoaded(r)) {
        return mcpError(r, -32000, 'Failed to load tool configuration', null);
    }

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
    // Build serverInfo from config, injecting description as extension field
    var serverInfo = {
        name: serverConfig.name || 'nginx-mcp-gateway',
        version: serverConfig.version || '1.0.0'
    };

    // Inject description if available (extension to MCP spec)
    if (serverConfig.description) {
        serverInfo.description = serverConfig.description;
    }

    var response = {
        jsonrpc: '2.0',
        result: {
            protocolVersion: '2024-11-05',
            capabilities: {
                tools: {}
            },
            serverInfo: serverInfo
        },
        id: request.id
    };

    r.headersOut['Content-Type'] = 'application/json';
    r.return(200, JSON.stringify(response));
}

/**
 * Handle tools/list request
 * Returns tools based on endpoint:
 * - /mcp → only service_card (discovery)
 * - /mcp/tools → all tools (full access)
 */
function handleToolsList(r, request) {
    var tools = [];
    var uri = r.uri;
    var discoveryOnly = (uri === '/mcp');

    for (var name in toolRegistry) {
        var tool = toolRegistry[name];

        // For /mcp endpoint, only return service_card
        if (discoveryOnly && tool.name !== 'service_card') {
            continue;
        }

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
 *
 * Supports two routing modes:
 * 1. Function-based (/execute): If tool has `function` property
 * 2. Endpoint-based (legacy): Uses backend.endpoint directly
 */
function handleToolCall(r, request) {
    var params = request.params || {};
    var toolName = params.name;
    var args = params.arguments || {};
    var startTime = Date.now();

    // Store start time for duration tracking
    r.variables.tool_start_time = startTime.toString();
    r.variables.tool_name = toolName || 'unknown';

    if (!toolName) {
        logEvent(r, 'tool_error', { tool: 'unknown', error: 'missing tool name' });
        return mcpError(r, -32602, 'Invalid params: missing tool name', request.id);
    }

    var tool = toolRegistry[toolName];
    if (!tool) {
        logEvent(r, 'tool_error', { tool: toolName, error: 'unknown tool' });
        return mcpError(r, -32602, 'Unknown tool: ' + toolName, request.id);
    }

    // Validate arguments against inputSchema before proxying
    var validationErrors = validateArgs(tool, args);
    if (validationErrors && validationErrors.length > 0) {
        logEvent(r, 'tool_error', { tool: toolName, error: validationErrors.join('; ') });
        return mcpError(r, -32602, 'Invalid params: ' + validationErrors.join('; '), request.id);
    }

    // Log the routing path for debugging intermittent failures
    var routingInfo = tool.handler || (tool.backend ? 'endpoint:' + tool.backend.endpoint : 'unknown');
    logEvent(r, 'tool_call', { tool: toolName, handler: routingInfo });

    // Check if tool is handled internally (no backend needed)
    if (tool.handler === 'internal') {
        return handleInternalTool(r, request, tool, args);
    }

    // Check if tool uses function-based routing (/execute pattern)
    if (tool.function) {
        return handleFunctionCall(r, request, tool, args);
    }

    // Legacy endpoint-based routing
    return handleEndpointCall(r, request, tool, args);
}

/**
 * Handle internal tools (no backend needed)
 * Currently supports: service_card
 */
function handleInternalTool(r, request, tool, args) {
    if (tool.name === 'service_card') {
        return handleServiceCardTool(r, request);
    }

    return mcpError(r, -32602, 'Unknown internal tool: ' + tool.name, request.id);
}

/**
 * Get base URL from request headers
 */
function getBaseUrl(r) {
    var scheme = r.variables.scheme || 'http';
    var host = r.headersIn['Host'] || r.variables.host || 'localhost:3000';
    return scheme + '://' + host;
}

/**
 * Handle service_card tool - returns server info as MCP response
 */
function handleServiceCardTool(r, request) {
    var baseUrl = getBaseUrl(r);
    var lines = [];

    // Header
    lines.push(serverConfig.name + ' v' + serverConfig.version);
    lines.push('');
    lines.push(serverConfig.description || 'MCP Gateway Service');
    lines.push('');

    // Instructions if available
    if (serverConfig.instructions) {
        lines.push(serverConfig.instructions.trim());
        lines.push('');
    }

    // Categories
    if (categoriesConfig.length > 0) {
        lines.push('Available Tool Categories:');
        lines.push('');
        categoriesConfig.forEach(function(cat) {
            lines.push('• ' + cat.name + ' - ' + cat.description);
            lines.push('  Tools: ' + cat.tools.join(', '));
        });
        lines.push('');
    }

    // Endpoint info with dynamic URLs
    lines.push('Gateway URL: ' + baseUrl);
    lines.push('');
    lines.push('MCP Endpoints:');
    lines.push('  GET  ' + baseUrl + '/mcp       - Service card (this info)');
    lines.push('  GET  ' + baseUrl + '/mcp/tools - List all tools');
    lines.push('  POST ' + baseUrl + '/mcp       - MCP JSON-RPC protocol');
    lines.push('');
    lines.push('HTTP REST Endpoints (direct access, no MCP):');
    lines.push('  GET  ' + baseUrl + '/api/nginx-memory          - OpenAPI spec');
    lines.push('  GET  ' + baseUrl + '/api/nginx-memory/schema   - Database schema');
    lines.push('  GET  ' + baseUrl + '/api/nginx-memory/status   - System status');
    lines.push('  GET  ' + baseUrl + '/api/nginx-memory/focus    - Current focus');
    lines.push('  POST ' + baseUrl + '/api/nginx-memory/semantic - Semantic search');
    lines.push('  POST ' + baseUrl + '/api/nginx-memory/text     - Text search');
    lines.push('  POST ' + baseUrl + '/api/nginx-memory/cypher   - Cypher query');
    lines.push('');
    lines.push('Total tools available: ' + Object.keys(toolRegistry).length);

    var response = {
        jsonrpc: '2.0',
        result: {
            content: [{
                type: 'text',
                text: lines.join('\n')
            }],
            isError: false
        },
        id: request.id
    };

    r.headersOut['Content-Type'] = 'application/json';
    r.return(200, JSON.stringify(response));
}

/**
 * Handle function-based tool call via /execute endpoint
 * Backend receives: { function: "name", arguments: {...} }
 */
function handleFunctionCall(r, request, tool, args) {
    var backendName = tool.backend;
    var backendUrl = routingConfig.backends ? routingConfig.backends[backendName] : null;

    if (!backendUrl) {
        backendUrl = routingConfig.default || 'http://localhost:5001';
    }

    var executeBody = {
        function: tool.function,
        arguments: args
    };

    var options = {
        method: 'POST',
        body: JSON.stringify(executeBody)
    };

    // Route through internal location that proxies to backend
    r.subrequest('/execute/' + backendName, options, function(reply) {
        handleBackendResponse(r, request, tool, reply);
    });
}

/**
 * Handle legacy endpoint-based tool call
 * Backend endpoint is called directly with arguments
 */
function handleEndpointCall(r, request, tool, args) {
    var endpoint = tool.backend.endpoint;
    var method = tool.backend.method || 'POST';

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
    var toolName = tool.name;
    var startTime = parseInt(r.variables.tool_start_time || '0', 10);
    var duration = startTime ? Date.now() - startTime : 0;

    if (backendReply.status >= 400) {
        // Backend error - include response body for debugging
        var errorDetail = '';
        var backendBody = backendReply.responseText || '';

        // Try to extract error message from JSON response
        if (backendBody) {
            try {
                var errorJson = JSON.parse(backendBody);
                // Common error message fields
                errorDetail = errorJson.error || errorJson.message || errorJson.detail || '';
                if (typeof errorDetail === 'object') {
                    errorDetail = JSON.stringify(errorDetail);
                }
            } catch (e) {
                // Not JSON, use raw text (truncated for safety)
                errorDetail = backendBody.substring(0, 200);
            }
        }

        var errorMessage = 'Backend error ' + backendReply.status;
        if (errorDetail) {
            errorMessage += ': ' + errorDetail;
        }

        logEvent(r, 'tool_error', {
            tool: toolName,
            status: backendReply.status,
            duration_ms: duration,
            error: errorDetail.substring(0, 100)
        });

        return mcpError(r, -32000, errorMessage, mcpRequest.id);
    }

    logEvent(r, 'tool_success', {
        tool: toolName,
        status: backendReply.status,
        duration_ms: duration
    });

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
 * Validate arguments against tool.inputSchema (object schemas only)
 * Returns an array of error strings or null if valid
 */
function validateArgs(tool, args) {
    var schema = tool.inputSchema;
    if (!schema || schema.type !== 'object') {
        return null;
    }

    var errors = [];
    var required = schema.required || [];
    var properties = schema.properties || {};

    // Required fields
    required.forEach(function(field) {
        if (!Object.prototype.hasOwnProperty.call(args, field)) {
            errors.push('Missing required field: ' + field);
        }
    });

    // Type + enum checks for provided fields
    for (var key in args) {
        if (!Object.prototype.hasOwnProperty.call(args, key)) {
            continue;
        }
        var prop = properties[key];
        if (!prop) {
            continue; // ignore unknown fields for now
        }

        var expectedType = prop.type;
        var actualType = getType(args[key]);
        if (expectedType && expectedType !== actualType) {
            errors.push('Invalid type for ' + key + ': expected ' + expectedType + ', got ' + actualType);
        }

        if (prop.enum && prop.enum.indexOf(args[key]) === -1) {
            errors.push('Invalid value for ' + key + ': ' + args[key]);
        }
    }

    return errors.length > 0 ? errors : null;
}

/**
 * Lightweight type resolver for schema validation
 */
function getType(value) {
    if (value === null || value === undefined) {
        return 'null';
    }
    if (Array.isArray(value)) {
        return 'array';
    }
    var t = typeof value;
    if (t === 'object') {
        return 'object';
    }
    if (t === 'number') {
        return 'number';
    }
    if (t === 'boolean') {
        return 'boolean';
    }
    if (t === 'string') {
        return 'string';
    }
    return t;
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
    return routingConfig.default || 'http://localhost:5001';
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

/**
 * Handle GET /mcp - Progressive Discovery Service Card
 * Returns human-readable service description for LLM comprehension
 */
function handleGetServiceCard(r) {
    if (!ensureLoaded(r)) {
        r.return(500, 'Failed to load configuration');
        return;
    }

    var lines = [];

    // Header
    lines.push(serverConfig.name + ' v' + serverConfig.version);
    lines.push('');
    lines.push(serverConfig.description || 'MCP Gateway Service');
    lines.push('');

    // Instructions if available
    if (serverConfig.instructions) {
        lines.push(serverConfig.instructions.trim());
        lines.push('');
    }

    // Categories
    if (categoriesConfig.length > 0) {
        lines.push('Available Tool Categories:');
        lines.push('');
        categoriesConfig.forEach(function(cat) {
            lines.push('• ' + cat.name + ' - ' + cat.description);
            lines.push('  Tools: ' + cat.tools.join(', '));
        });
        lines.push('');
    }

    // Endpoint info
    lines.push('Endpoints:');
    lines.push('  GET  /mcp       - This service card (discovery)');
    lines.push('  GET  /mcp/tools - List all tools with descriptions');
    lines.push('  POST /mcp/tools - MCP JSON-RPC protocol endpoint');
    lines.push('');
    lines.push('Total tools available: ' + Object.keys(toolRegistry).length);

    r.headersOut['Content-Type'] = 'text/plain; charset=utf-8';
    r.headersOut['Access-Control-Allow-Origin'] = '*';
    r.return(200, lines.join('\n'));
}

/**
 * Handle GET /mcp/tools - List all tools with descriptions
 * Returns human-readable tool listing for LLM comprehension
 */
function handleGetTools(r) {
    if (!ensureLoaded(r)) {
        r.return(500, 'Failed to load configuration');
        return;
    }

    var lines = [];

    lines.push('Available Tools - ' + serverConfig.name);
    lines.push('='.repeat(50));
    lines.push('');

    // Group by category if available
    if (categoriesConfig.length > 0) {
        categoriesConfig.forEach(function(cat) {
            lines.push('[' + cat.name + '] ' + cat.description);
            lines.push('-'.repeat(40));

            cat.tools.forEach(function(toolName) {
                var tool = toolRegistry[toolName];
                if (tool) {
                    lines.push('  ' + tool.name);
                    lines.push('    ' + tool.description);

                    // Show required params
                    if (tool.inputSchema && tool.inputSchema.required) {
                        lines.push('    Required: ' + tool.inputSchema.required.join(', '));
                    }
                }
            });
            lines.push('');
        });

        // Show uncategorized tools
        var categorizedTools = [];
        categoriesConfig.forEach(function(cat) {
            categorizedTools = categorizedTools.concat(cat.tools);
        });

        var uncategorized = Object.keys(toolRegistry).filter(function(name) {
            return categorizedTools.indexOf(name) === -1;
        });

        if (uncategorized.length > 0) {
            lines.push('[Uncategorized]');
            lines.push('-'.repeat(40));
            uncategorized.forEach(function(toolName) {
                var tool = toolRegistry[toolName];
                lines.push('  ' + tool.name);
                lines.push('    ' + tool.description);
            });
            lines.push('');
        }
    } else {
        // No categories, just list all tools
        for (var name in toolRegistry) {
            var tool = toolRegistry[name];
            lines.push(tool.name);
            lines.push('  ' + tool.description);
            if (tool.inputSchema && tool.inputSchema.required) {
                lines.push('  Required: ' + tool.inputSchema.required.join(', '));
            }
            lines.push('');
        }
    }

    lines.push('='.repeat(50));
    lines.push('Use POST /mcp/tools with MCP JSON-RPC to call these tools.');

    r.headersOut['Content-Type'] = 'text/plain; charset=utf-8';
    r.headersOut['Access-Control-Allow-Origin'] = '*';
    r.return(200, lines.join('\n'));
}

/**
 * Main entry point - routes based on HTTP method
 * GET  /mcp       → service card
 * GET  /mcp/tools → tool listing
 * POST /mcp       → MCP JSON-RPC (existing)
 * POST /mcp/tools → MCP JSON-RPC (alias)
 */
function handleRequest(r) {
    var method = r.method;
    var uri = r.uri;

    if (method === 'GET') {
        if (uri === '/mcp/tools') {
            return handleGetTools(r);
        } else {
            return handleGetServiceCard(r);
        }
    } else if (method === 'POST') {
        return handleMCPRequest(r);
    } else if (method === 'OPTIONS') {
        r.headersOut['Access-Control-Allow-Origin'] = '*';
        r.headersOut['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
        r.headersOut['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
        r.return(204);
    } else {
        r.return(405, 'Method Not Allowed');
    }
}

// Export functions for NGINX
export default { init, handleMCPRequest, handleSSE, handleGetServiceCard, handleGetTools, handleRequest };
