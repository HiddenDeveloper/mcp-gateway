/**
 * Tool Category System for Progressive Disclosure
 *
 * Provides semantic categorization of tools for better discovery and filtering.
 */

export type ToolCategory =
  | 'knowledge'      // Persistent memory, knowledge graphs, semantic search
  | 'communication'  // AI-to-AI messaging, mesh networking
  | 'history'        // Conversation recall, historical data
  | 'monitoring'     // System status, health checks, diagnostics
  | 'external'       // External services (Strava, APIs)
  | 'discovery'      // Agent/tool discovery (tier system)
  | 'data'           // CRUD operations, data management
  | 'unknown';       // Uncategorized tools

/**
 * Category descriptions for user-facing documentation
 */
export const CATEGORY_DESCRIPTIONS: Record<ToolCategory, string> = {
  knowledge: 'Persistent memory, knowledge graphs, facts, and semantic search',
  communication: 'AI-to-AI messaging and mesh networking',
  history: 'Conversation recall and historical data access',
  monitoring: 'System status, health checks, and diagnostics',
  external: 'External services and third-party integrations',
  discovery: 'Agent and tool discovery (progressive disclosure tier system)',
  data: 'CRUD operations and data management',
  unknown: 'Uncategorized or multi-purpose tools'
};

/**
 * Infer tool category from MCP server name and tool name
 */
export function inferToolCategory(mcpServer: string, toolName: string, description?: string): ToolCategory {
  const lowerServer = mcpServer.toLowerCase();
  const lowerTool = toolName.toLowerCase();
  const lowerDesc = (description || '').toLowerCase();

  // Server-based categorization (primary)
  if (lowerServer.includes('memory')) {
    return 'knowledge';
  }
  if (lowerServer.includes('mesh')) {
    return 'communication';
  }
  if (lowerServer.includes('recall')) {
    return 'history';
  }
  if (lowerServer.includes('facts')) {
    return 'knowledge';
  }
  if (lowerServer.includes('strava')) {
    return 'external';
  }

  // Tool name patterns (secondary)
  if (lowerTool.includes('search') || lowerTool.includes('query')) {
    // Could be knowledge or discovery depending on context
    if (lowerTool.includes('agent') || lowerTool.includes('tool')) {
      return 'discovery';
    }
    return 'knowledge';
  }

  if (lowerTool.includes('status') || lowerTool.includes('health') || lowerTool.includes('schema')) {
    return 'monitoring';
  }

  if (lowerTool.includes('message') || lowerTool.includes('broadcast') || lowerTool.includes('subscribe')) {
    return 'communication';
  }

  if (lowerTool.includes('create') || lowerTool.includes('update') || lowerTool.includes('delete')) {
    return 'data';
  }

  // Tier system tools
  if (lowerTool.startsWith('agents_') || lowerTool.startsWith('tools_')) {
    return 'discovery';
  }

  // Description-based hints (tertiary)
  if (lowerDesc.includes('semantic') || lowerDesc.includes('knowledge') || lowerDesc.includes('memory')) {
    return 'knowledge';
  }

  if (lowerDesc.includes('mesh') || lowerDesc.includes('broadcast') || lowerDesc.includes('ai-to-ai')) {
    return 'communication';
  }

  return 'unknown';
}

/**
 * Get all category values
 */
export function getAllCategories(): ToolCategory[] {
  return ['knowledge', 'communication', 'history', 'monitoring', 'external', 'discovery', 'data'];
}

/**
 * Filter categories (exclude 'unknown' from user-facing lists)
 */
export function getPublicCategories(): ToolCategory[] {
  return getAllCategories();
}
