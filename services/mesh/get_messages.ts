/**
 * Get Messages
 *
 * Retrieve messages from the mesh inbox.
 * Returns messages addressed to this session or to ALL.
 * Supports filtering by message type, priority, and read status.
 */

import {
  config,
  queryMessages,
  markAsRead,
  getOrCreateSession,
} from "./lib/config";
import type { MessageType, PriorityLevel } from "./lib/config";

interface Params {
  limit?: number;
  unreadOnly?: boolean;
  messageType?: MessageType;
  priority?: PriorityLevel;
  autoMarkRead?: boolean;
  participantName?: string;
}

export default async function (params: Record<string, unknown>) {
  const {
    limit = 20,
    unreadOnly = true,
    messageType,
    priority,
    autoMarkRead = true,
    participantName,
  } = params as Params;

  try {
    // Ensure session exists
    const session = await getOrCreateSession(
      participantName || config.participantName
    );

    // Query messages for this session
    const messages = await queryMessages({
      toSession: session.sessionId,
      unreadOnly,
      sessionId: session.sessionId,
      messageType,
      priority,
      limit,
    });

    // Auto-mark messages as read if requested
    if (autoMarkRead) {
      for (const msg of messages) {
        if (!msg.readBy.includes(session.sessionId)) {
          await markAsRead(msg.id, session.sessionId);
        }
      }
    }

    // Format response
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

    // Count unread (before we marked them)
    const unreadCount = messages.filter(
      (m) => !m.readBy.includes(session.sessionId)
    ).length;

    return {
      sessionId: session.sessionId,
      participantName: session.participantName,
      messages: formattedMessages,
      count: formattedMessages.length,
      unreadCount: autoMarkRead ? 0 : unreadCount,
    };
  } catch (error) {
    console.error("[get_messages] Error:", error);
    throw error;
  }
}
