/**
 * List Protocols
 *
 * List available workflow protocols from the protocols directory.
 *
 * Standalone implementation - no external dependencies.
 */

import { listProtocols } from "./lib/protocol-executor";
import type { ProtocolsListParams } from "./lib/types";

export default async function (params: Record<string, unknown>) {
  const { category } = params as ProtocolsListParams;

  try {
    let protocols = await listProtocols();

    // Filter by category if specified
    if (category) {
      protocols = protocols.filter(p => p.category === category);
    }

    return {
      protocols: protocols.map(p => ({
        name: p.name,
        version: p.version,
        description: p.description,
        category: p.category,
        tags: p.tags,
      })),
      count: protocols.length,
    };
  } catch (error) {
    console.error("[orchestrator/protocols_list] Error:", error);
    throw error;
  }
}
