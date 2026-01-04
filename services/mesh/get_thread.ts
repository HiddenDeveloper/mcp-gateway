/**
 * Get Thread
 *
 * Retrieve all messages in a conversation thread.
 * Returns the original message and all replies.
 */

import { getThread, getOrCreateSession, config } from "./lib/config";

interface Params {
  messageId: string;
  participantName?: string;
}

export default async function (params: Record<string, unknown>) {
  const { messageId, participantName } = params as Params;

  if (!messageId) {
    throw new Error("Missing required parameter: messageId");
  }

  try {
    // Get session for context
    const session = await getOrCreateSession(
      participantName || config.participantName
    );

    // Get all messages in the thread
    const messages = await getThread(messageId);

    if (messages.length === 0) {
      return {
        success: false,
        error: "Message not found",
        threadId: messageId,
      };
    }

    // Format messages
    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      fromSession: msg.fromSession,
      toSession: msg.toSession,
      messageType: msg.messageType,
      content: msg.content,
      context: msg.context,
      priority: msg.priority,
      timestamp: msg.timestamp,
      requiresResponse: msg.requiresResponse,
      participantName: msg.participantName,
      originalMessageId: msg.originalMessageId,
      isOwn: msg.fromSession === session.sessionId,
      isRead: msg.readBy.includes(session.sessionId),
    }));

    return {
      success: true,
      threadId: messageId,
      messages: formattedMessages,
      count: formattedMessages.length,
    };
  } catch (error) {
    console.error("[get_thread] Error:", error);
    throw error;
  }
}
