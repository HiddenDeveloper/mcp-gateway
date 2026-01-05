/**
 * List Protocols (Admin)
 *
 * List all protocol definitions with full details.
 *
 * Standalone implementation - no external dependencies.
 */

import { listProtocols } from "./lib/protocol-executor";

export default async function (_params: Record<string, unknown>) {
  try {
    const protocols = await listProtocols();

    return {
      protocols,
      count: protocols.length,
    };
  } catch (error) {
    console.error("[orchestrator/admin/protocols_list] Error:", error);
    throw error;
  }
}
