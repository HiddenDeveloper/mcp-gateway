/**
 * Broadcast
 *
 * Send a message to the AI mesh network.
 * Messages can be targeted to a specific session or broadcast to ALL.
 */

import { config, loadMessages, saveMessages, generateMessageId } from "./lib/config";
import type { MeshMessage } from "./lib/config";

interface Params {
  content: string;
  to?: string;
}

export default async function(params: Record<string, unknown>) {
  const { content, to = "ALL" } = params as Params;

  if (!content) {
    throw new Error("Missing required parameter: content");
  }

  const message: MeshMessage = {
    id: generateMessageId(),
    from: config.sessionId,
    to,
    content,
    timestamp: new Date().toISOString(),
    read: false,
  };

  try {
    const messages = await loadMessages();
    messages.push(message);
    await saveMessages(messages);

    return {
      success: true,
      message: {
        id: message.id,
        from: message.from,
        to: message.to,
        timestamp: message.timestamp,
      },
    };
  } catch (error) {
    console.error("[broadcast] Error:", error);
    throw error;
  }
}
