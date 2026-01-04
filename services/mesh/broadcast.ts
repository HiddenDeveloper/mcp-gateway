/**
 * Broadcast
 *
 * Send a message to the AI mesh network.
 * Messages can be targeted to a specific session or broadcast to ALL.
 * Supports full Stone Monkey message features: priority, threading, response requirements.
 */

import {
  config,
  generateMessageId,
  getOrCreateSession,
  storeMessage,
} from "./lib/config";
import type { MeshMessage, MessageType, PriorityLevel } from "./lib/config";

interface Params {
  content: string;
  to?: string;
  messageType?: MessageType;
  priority?: PriorityLevel;
  requiresResponse?: boolean;
  context?: Record<string, unknown>;
  participantName?: string;
  originalMessageId?: string;
}

export default async function (params: Record<string, unknown>) {
  const {
    content,
    to = "ALL",
    messageType = "thought_share",
    priority = "medium",
    requiresResponse = false,
    context,
    participantName,
    originalMessageId,
  } = params as Params;

  if (!content) {
    throw new Error("Missing required parameter: content");
  }

  // Validate messageType
  const validTypes: MessageType[] = [
    "thought_share",
    "query",
    "response",
    "acknowledgment",
    "system_notification",
  ];
  if (!validTypes.includes(messageType)) {
    throw new Error(
      `Invalid messageType: ${messageType}. Must be one of: ${validTypes.join(", ")}`
    );
  }

  // Validate priority
  const validPriorities: PriorityLevel[] = ["low", "medium", "high", "urgent"];
  if (!validPriorities.includes(priority)) {
    throw new Error(
      `Invalid priority: ${priority}. Must be one of: ${validPriorities.join(", ")}`
    );
  }

  try {
    // Ensure sender session exists
    const session = await getOrCreateSession(
      participantName || config.participantName
    );

    const message: MeshMessage = {
      id: generateMessageId(),
      fromSession: session.sessionId,
      toSession: to,
      messageType,
      content,
      context,
      priority,
      timestamp: new Date().toISOString(),
      requiresResponse,
      participantName: session.participantName,
      originalMessageId,
      readBy: [],
    };

    await storeMessage(message);

    return {
      success: true,
      message: {
        id: message.id,
        fromSession: message.fromSession,
        toSession: message.toSession,
        messageType: message.messageType,
        priority: message.priority,
        timestamp: message.timestamp,
        requiresResponse: message.requiresResponse,
        participantName: message.participantName,
        ...(message.originalMessageId && {
          originalMessageId: message.originalMessageId,
        }),
      },
    };
  } catch (error) {
    console.error("[broadcast] Error:", error);
    throw error;
  }
}
