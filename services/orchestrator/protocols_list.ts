/**
 * List Protocols
 *
 * List available multi-agent workflow patterns.
 * Currently returns a stub - full implementation deferred to Phase 2.
 */

import type { ProtocolsListParams } from "./lib/types";

export default async function (params: Record<string, unknown>) {
  const { category } = params as ProtocolsListParams;

  try {
    // Stub implementation - returns empty list
    // Full implementation will load from config/protocols/ directory

    console.log("[orchestrator/protocols_list] Returning stub (Phase 2 implementation pending)");

    return {
      protocols: [],
      count: 0,
      message: "Protocol execution is not yet implemented. This is a Phase 2 feature.",
      ...(category && { filtered_by: category }),
    };
  } catch (error) {
    console.error("[orchestrator/protocols_list] Error:", error);
    throw error;
  }
}
