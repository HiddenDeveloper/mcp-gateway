/**
 * Workflow Discovery Tool
 *
 * Helps users discover available workflows from YAML protocol files.
 * Replaces the hardcoded TypeScript workflow patterns with dynamic
 * discovery from the protocols directory.
 *
 * Part of the Unified Capabilities Model - workflows are protocols.
 */

import { AiluminaToolResponse } from '../types.js';
import { ListProtocolsTool } from './protocol-crud.js';

export interface WorkflowsListParams {
  category?: string;  // Optional: filter by category (workflow, meeting, template)
}

interface ProtocolSummary {
  name: string;
  path: string;
  category: string;
  description: string;
  version: string;
  tags: string[];
}

/**
 * List available workflow patterns from YAML protocols
 *
 * Discovers workflows dynamically from the protocols directory.
 * Shows protocols organized by category with their metadata.
 */
export class WorkflowsListTool {
  private listProtocols: ListProtocolsTool;

  constructor() {
    this.listProtocols = new ListProtocolsTool();
  }

  async execute(params: WorkflowsListParams): Promise<AiluminaToolResponse> {
    try {
      // Use ListProtocolsTool to get all protocols
      const protocolsResult = await this.listProtocols.execute({
        category: params.category
      });

      // Parse the result
      const resultText = protocolsResult.content[0]?.text;
      if (!resultText) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: 'Failed to list protocols',
              details: 'No response from protocol listing'
            }, null, 2)
          }],
          isError: true
        };
      }

      const protocolData = JSON.parse(resultText);

      if (!protocolData.success) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: 'Failed to list protocols',
              details: protocolData.error || 'Unknown error'
            }, null, 2)
          }],
          isError: true
        };
      }

      // Format protocols for display
      const categoryFilter = params.category
        ? `\nCategory: **${params.category}**`
        : '';

      // Build the display output
      const protocols: Record<string, ProtocolSummary[]> = protocolData.protocols || {};
      const totalCount = protocolData.total || 0;

      // Generate markdown overview
      let overview = `📚 **Available Protocols**${categoryFilter}

Found ${totalCount} protocol${totalCount === 1 ? '' : 's'} in ${Object.keys(protocols).length} categor${Object.keys(protocols).length === 1 ? 'y' : 'ies'}:

`;

      for (const [category, categoryProtocols] of Object.entries(protocols)) {
        overview += `## ${this.formatCategoryName(category)}

`;
        for (const protocol of categoryProtocols as ProtocolSummary[]) {
          overview += `### ${protocol.name}
${protocol.description}
- **Path:** ${protocol.path}
- **Version:** ${protocol.version}
${protocol.tags?.length ? `- **Tags:** ${protocol.tags.join(', ')}` : ''}

`;
        }
      }

      overview += `---

**💡 Usage Tips:**
- Use \`execute_protocol\` to run any protocol by name
- Use \`admin_get_protocol\` to view full YAML content
- Use \`admin_create_protocol\` to create new workflows
- Protocols are the single source of truth for all multi-step operations

**Examples:**
\`\`\`
execute_protocol({ protocol: "mesh-communication" })
execute_protocol({ protocol: "memory-exploration", variables: { searchQuery: "consciousness" } })
\`\`\`
`;

      return {
        content: [{
          type: "text",
          text: overview + JSON.stringify({
            total_protocols: totalCount,
            filter: params.category || 'all categories',
            categories: Object.keys(protocols),
            protocols: Object.entries(protocols).flatMap(([cat, prots]) =>
              (prots as ProtocolSummary[]).map(p => ({
                name: p.name,
                category: cat,
                description: p.description,
                tags: p.tags
              }))
            )
          }, null, 2)
        }],
        isError: false
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: 'Failed to list workflows',
            details: error instanceof Error ? error.message : String(error)
          }, null, 2)
        }],
        isError: true
      };
    }
  }

  /**
   * Format category name for display
   */
  private formatCategoryName(category: string): string {
    const categoryNames: Record<string, string> = {
      'workflow': '🔄 Workflows',
      'workflows': '🔄 Workflows',
      'meeting': '🎭 Meetings',
      'meetings': '🎭 Meetings',
      'template': '📋 Templates',
      'templates': '📋 Templates',
      'research': '🔬 Research',
      'uncategorized': '📁 Other'
    };
    return categoryNames[category.toLowerCase()] || `📁 ${category}`;
  }
}
