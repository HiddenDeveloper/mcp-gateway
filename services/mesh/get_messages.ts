/**
 * Get Messages
 *
 * Retrieve messages from the mesh inbox.
 * Returns messages addressed to this session or to ALL.
 */

import { config, loadMessages, saveMessages } from "./lib/config";
import type { MeshMessage } from "./lib/config";

interface Params {
  limit?: number;
  include_read?: boolean;
}

export default async function(params: Record<string, unknown>) {
  const { limit = 20, include_read = false } = params as Params;

  try {
    const allMessages = await loadMessages();

    // Filter messages for this session (addressed to us or to ALL)
    let relevantMessages = allMessages.filter(
      (msg) =>
        msg.to === "ALL" ||
        msg.to === config.sessionId ||
        msg.from === config.sessionId // Include our own messages
    );

    // Filter by read status if needed
    if (!include_read) {
      relevantMessages = relevantMessages.filter((msg) => !msg.read);
    }

    // Sort by timestamp descending (newest first)
    relevantMessages.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply limit
    const limitedMessages = relevantMessages.slice(0, limit);

    // Mark retrieved messages as read
    const messageIds = new Set(limitedMessages.map((m) => m.id));
    let updated = false;

    for (const msg of allMessages) {
      if (messageIds.has(msg.id) && !msg.read) {
        msg.read = true;
        updated = true;
      }
    }

    if (updated) {
      await saveMessages(allMessages);
    }

    // Format response
    const formattedMessages = limitedMessages.map((msg) => ({
      id: msg.id,
      from: msg.from,
      to: msg.to,
      content: msg.content,
      timestamp: msg.timestamp,
      isOwn: msg.from === config.sessionId,
    }));

    return {
      sessionId: config.sessionId,
      messages: formattedMessages,
      count: formattedMessages.length,
      hasMore: relevantMessages.length > limit,
    };
  } catch (error) {
    console.error("[get_messages] Error:", error);
    throw error;
  }
}
