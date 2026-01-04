/**
 * Ailumina Chat
 *
 * Route natural language to the appropriate agent.
 * Tier 0 - the highest level abstraction for conversational AI.
 */

import { callBridgeTool, type AiluminaChatParams } from "./lib/config";

export default async function (params: Record<string, unknown>) {
  const {
    agent_type,
    user_input,
    chat_messages,
    fileId,
    server_url,
  } = params as AiluminaChatParams;

  if (!agent_type) {
    throw new Error("Missing required parameter: agent_type");
  }
  if (!user_input) {
    throw new Error("Missing required parameter: user_input");
  }

  try {
    const result = await callBridgeTool("ailumina_chat", {
      agent_type,
      user_input,
      ...(chat_messages && { chat_messages }),
      ...(fileId && { fileId }),
      ...(server_url && { server_url }),
    });
    return result;
  } catch (error) {
    console.error("[orchestrator/chat/route] Error:", error);
    throw error;
  }
}
