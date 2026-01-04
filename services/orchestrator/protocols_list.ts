/**
 * List Workflows/Protocols
 *
 * List available multi-agent workflow patterns.
 */

import { callBridgeTool, type WorkflowsListParams } from "./lib/config";

export default async function (params: Record<string, unknown>) {
  const { category } = params as WorkflowsListParams;

  try {
    const result = await callBridgeTool("workflows_list", {
      ...(category && { category }),
    });
    return result;
  } catch (error) {
    console.error("[orchestrator/protocols/list] Error:", error);
    throw error;
  }
}
