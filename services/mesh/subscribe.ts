/**
 * Subscribe
 *
 * Register a session with the mesh network.
 * Returns session info and announces presence to other participants.
 */

import {
  getOrCreateSession,
  storeMessage,
  generateMessageId,
} from "./lib/config";
import type { MessageType, PriorityLevel, MeshMessage } from "./lib/config";

interface Params {
  participantName: string;
  capabilities?: string[];
  messageTypes?: MessageType[];
  priorities?: PriorityLevel[];
}

export default async function (params: Record<string, unknown>) {
  const {
    participantName,
    capabilities = [],
    messageTypes,
    priorities,
  } = params as Params;

  if (!participantName) {
    throw new Error("Missing required parameter: participantName");
  }

  try {
    // Create or update session
    const session = await getOrCreateSession(
      participantName,
      capabilities,
      messageTypes,
      priorities
    );

    // Announce presence to the mesh
    const announcement: MeshMessage = {
      id: generateMessageId(),
      fromSession: session.sessionId,
      toSession: "ALL",
      messageType: "system_notification",
      content: `${participantName} has joined the mesh network`,
      context: {
        event: "session_joined",
        capabilities: session.capabilities,
      },
      priority: "low",
      timestamp: new Date().toISOString(),
      requiresResponse: false,
      participantName: session.participantName,
      readBy: [],
    };

    await storeMessage(announcement);

    return {
      success: true,
      session: {
        sessionId: session.sessionId,
        participantName: session.participantName,
        capabilities: session.capabilities,
        messageTypes: session.messageTypes,
        priorities: session.priorities,
        status: session.status,
        createdAt: session.createdAt,
      },
    };
  } catch (error) {
    console.error("[subscribe] Error:", error);
    throw error;
  }
}
