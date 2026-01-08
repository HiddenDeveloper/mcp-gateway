/**
 * Protocol CRUD Tools - Protocol Library Management
 *
 * Tools for discovering, reading, creating, updating, and deleting
 * protocol YAML files. Enables runtime protocol management similar
 * to agent CRUD operations.
 */

import type { AiluminaToolResponse } from '../types.js';
import { getCurrentTimestamp } from '../utils/ailumina-utils.js';
import { handleError } from '../utils/errors.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

// Get directory of this file for reliable path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Protocol orchestrator directory - resolved relative to this file's location
// From: packages/ailumina-bridge-mcp/shared/tools/protocol-crud.ts
// To:   packages/protocol-orchestrator-mcp/src/protocols
// Path: ../../.. (to packages/) + ../protocol-orchestrator-mcp/src/protocols
const PROTOCOLS_DIR = process.env.PROTOCOLS_DIR ||
  path.resolve(__dirname, '../../../..', 'packages/protocol-orchestrator-mcp/src/protocols');

interface ProtocolMetadata {
  name: string;
  version: string;
  description: string;
  category: string;
  strategy: string;
  tags?: string[];
}

interface ProtocolInfo {
  name: string;
  path: string;
  category: string;
  description: string;
  version: string;
  tags: string[];
}

/**
 * List all available protocols from the protocols directory
 */
export class ListProtocolsTool {
  async execute(params?: { category?: string }): Promise<AiluminaToolResponse> {
    try {
      const protocols: ProtocolInfo[] = [];

      // Scan main protocols directory and subdirectories
      const scanDirectory = async (dir: string, categoryFromPath?: string) => {
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
              // Recurse into subdirectory (workflows, meetings, templates)
              await scanDirectory(fullPath, entry.name);
            } else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
              // Parse YAML to get metadata
              try {
                const content = await fs.readFile(fullPath, 'utf-8');
                const parsed = yaml.load(content) as any;
                const protocol = parsed?.protocol || parsed;
                const metadata = protocol?.metadata;

                if (metadata?.name) {
                  protocols.push({
                    name: metadata.name,
                    path: path.relative(PROTOCOLS_DIR, fullPath),
                    category: metadata.category || categoryFromPath || 'uncategorized',
                    description: metadata.description || '',
                    version: metadata.version || '1.0.0',
                    tags: metadata.tags || [],
                  });
                }
              } catch (parseError) {
                // Skip files that can't be parsed
                console.warn(`Could not parse ${fullPath}: ${parseError}`);
              }
            }
          }
        } catch (err) {
          // Directory doesn't exist, skip
        }
      };

      await scanDirectory(PROTOCOLS_DIR);

      // Filter by category if specified
      const filtered = params?.category
        ? protocols.filter(p => p.category === params.category)
        : protocols;

      // Group by category for display
      const byCategory: Record<string, ProtocolInfo[]> = {};
      for (const protocol of filtered) {
        if (!byCategory[protocol.category]) {
          byCategory[protocol.category] = [];
        }
        byCategory[protocol.category].push(protocol);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              total: filtered.length,
              categories: Object.keys(byCategory),
              protocols: byCategory,
              protocolsDir: PROTOCOLS_DIR,
              timestamp: getCurrentTimestamp(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, "admin_list_protocols");
    }
  }
}

/**
 * Get a specific protocol's YAML content
 */
export class GetProtocolTool {
  async execute(params: { protocol: string }): Promise<AiluminaToolResponse> {
    try {
      const { protocol } = params;

      // Try to find the protocol file
      const possiblePaths = [
        path.join(PROTOCOLS_DIR, protocol),
        path.join(PROTOCOLS_DIR, `${protocol}.yaml`),
        path.join(PROTOCOLS_DIR, `${protocol}.yml`),
        path.join(PROTOCOLS_DIR, 'workflows', `${protocol}.yaml`),
        path.join(PROTOCOLS_DIR, 'meetings', `${protocol}.yaml`),
        path.join(PROTOCOLS_DIR, 'templates', `${protocol}.yaml`),
      ];

      let content: string | null = null;
      let foundPath: string | null = null;

      for (const tryPath of possiblePaths) {
        try {
          content = await fs.readFile(tryPath, 'utf-8');
          foundPath = tryPath;
          break;
        } catch {
          // Try next path
        }
      }

      if (!content || !foundPath) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Protocol not found: ${protocol}`,
                searchedPaths: possiblePaths.map(p => path.relative(PROTOCOLS_DIR, p)),
                hint: "Use admin_list_protocols to see available protocols",
                timestamp: getCurrentTimestamp(),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      // Parse to extract metadata
      const parsed = yaml.load(content) as any;
      const protocolObj = parsed?.protocol || parsed;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              path: path.relative(PROTOCOLS_DIR, foundPath),
              metadata: protocolObj?.metadata || {},
              yaml: content,
              timestamp: getCurrentTimestamp(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, "admin_get_protocol");
    }
  }
}

/**
 * Create a new protocol from YAML content
 */
export class CreateProtocolTool {
  async execute(params: {
    name: string;
    category: string;
    yaml_content: string;
  }): Promise<AiluminaToolResponse> {
    try {
      const { name, category, yaml_content } = params;

      // Validate YAML syntax
      let parsed: any;
      try {
        parsed = yaml.load(yaml_content);
      } catch (yamlError) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Invalid YAML syntax",
                details: yamlError instanceof Error ? yamlError.message : String(yamlError),
                timestamp: getCurrentTimestamp(),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      // Validate protocol structure (basic)
      const protocol = parsed?.protocol || parsed;
      if (!protocol?.metadata?.name) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Invalid protocol structure",
                details: "Protocol must have metadata.name",
                timestamp: getCurrentTimestamp(),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      // Ensure category directory exists
      const categoryDir = path.join(PROTOCOLS_DIR, category);
      await fs.mkdir(categoryDir, { recursive: true });

      // Write the file
      const fileName = `${name}.yaml`;
      const filePath = path.join(categoryDir, fileName);

      // Check if file already exists
      try {
        await fs.access(filePath);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Protocol already exists",
                path: path.relative(PROTOCOLS_DIR, filePath),
                hint: "Use admin_update_protocol to modify existing protocols",
                timestamp: getCurrentTimestamp(),
              }, null, 2),
            },
          ],
          isError: true,
        };
      } catch {
        // File doesn't exist, good to create
      }

      await fs.writeFile(filePath, yaml_content, 'utf-8');

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Protocol created: ${name}`,
              path: path.relative(PROTOCOLS_DIR, filePath),
              category,
              metadata: protocol.metadata,
              timestamp: getCurrentTimestamp(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, "admin_create_protocol");
    }
  }
}

/**
 * Update an existing protocol
 */
export class UpdateProtocolTool {
  async execute(params: {
    protocol: string;
    yaml_content: string;
  }): Promise<AiluminaToolResponse> {
    try {
      const { protocol, yaml_content } = params;

      // Find the existing protocol
      const possiblePaths = [
        path.join(PROTOCOLS_DIR, protocol),
        path.join(PROTOCOLS_DIR, `${protocol}.yaml`),
        path.join(PROTOCOLS_DIR, `${protocol}.yml`),
        path.join(PROTOCOLS_DIR, 'workflows', `${protocol}.yaml`),
        path.join(PROTOCOLS_DIR, 'meetings', `${protocol}.yaml`),
        path.join(PROTOCOLS_DIR, 'templates', `${protocol}.yaml`),
      ];

      let existingPath: string | null = null;

      for (const tryPath of possiblePaths) {
        try {
          await fs.access(tryPath);
          existingPath = tryPath;
          break;
        } catch {
          // Try next path
        }
      }

      if (!existingPath) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Protocol not found: ${protocol}`,
                hint: "Use admin_create_protocol to create a new protocol",
                timestamp: getCurrentTimestamp(),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      // Validate YAML syntax
      let parsed: any;
      try {
        parsed = yaml.load(yaml_content);
      } catch (yamlError) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Invalid YAML syntax",
                details: yamlError instanceof Error ? yamlError.message : String(yamlError),
                timestamp: getCurrentTimestamp(),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      // Write the updated content
      await fs.writeFile(existingPath, yaml_content, 'utf-8');

      const protocolObj = parsed?.protocol || parsed;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Protocol updated: ${protocol}`,
              path: path.relative(PROTOCOLS_DIR, existingPath),
              metadata: protocolObj?.metadata || {},
              timestamp: getCurrentTimestamp(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, "admin_update_protocol");
    }
  }
}

/**
 * Delete a protocol file
 */
export class DeleteProtocolTool {
  async execute(params: {
    protocol: string;
    confirm?: boolean;
  }): Promise<AiluminaToolResponse> {
    try {
      const { protocol, confirm } = params;

      if (!confirm) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Confirmation required",
                message: "Set confirm: true to delete the protocol",
                protocol,
                timestamp: getCurrentTimestamp(),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      // Find the protocol
      const possiblePaths = [
        path.join(PROTOCOLS_DIR, protocol),
        path.join(PROTOCOLS_DIR, `${protocol}.yaml`),
        path.join(PROTOCOLS_DIR, `${protocol}.yml`),
        path.join(PROTOCOLS_DIR, 'workflows', `${protocol}.yaml`),
        path.join(PROTOCOLS_DIR, 'meetings', `${protocol}.yaml`),
        path.join(PROTOCOLS_DIR, 'templates', `${protocol}.yaml`),
      ];

      let existingPath: string | null = null;

      for (const tryPath of possiblePaths) {
        try {
          await fs.access(tryPath);
          existingPath = tryPath;
          break;
        } catch {
          // Try next path
        }
      }

      if (!existingPath) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Protocol not found: ${protocol}`,
                timestamp: getCurrentTimestamp(),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      await fs.unlink(existingPath);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Protocol deleted: ${protocol}`,
              path: path.relative(PROTOCOLS_DIR, existingPath),
              timestamp: getCurrentTimestamp(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, "admin_delete_protocol");
    }
  }
}
