/**
 * Mark Read
 *
 * Mark a specific message as read by a session.
 */

import { markAsRead, getOrCreateSession, config } from "./lib/config";

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
    // Get or create session
    const session = await getOrCreateSession(
      participantName || config.participantName
    );

    // Mark the message as read
    const success = await markAsRead(messageId, session.sessionId);

    return {
      success,
      messageId,
      sessionId: session.sessionId,
      message: success
        ? "Message marked as read"
        : "Message not found or already read",
    };
  } catch (error) {
    console.error("[mark_read] Error:", error);
    throw error;
  }
}
