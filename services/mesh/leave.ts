/**
 * Leave
 *
 * Leave the mesh network and mark session as archived.
 * Announces departure to other participants.
 */

import {
  getSession,
  leaveSession,
  storeMessage,
  generateMessageId,
} from "./lib/config";
import type { MeshMessage } from "./lib/config";

interface Params {
  sessionId: string;
}

export default async function (params: Record<string, unknown>) {
  const { sessionId } = params as Params;

  if (!sessionId) {
    throw new Error("Missing required parameter: sessionId");
  }

  try {
    // Get session info before leaving
    const session = await getSession(sessionId);

    if (!session) {
      return {
        success: false,
        error: "Session not found",
      };
    }

    // Archive the session
    await leaveSession(sessionId);

    // Announce departure to the mesh
    const announcement: MeshMessage = {
      id: generateMessageId(),
      fromSession: sessionId,
      toSession: "ALL",
      messageType: "system_notification",
      content: `${session.participantName} has left the mesh network`,
      context: {
        event: "session_left",
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
      message: `Session ${sessionId} has been archived`,
    };
  } catch (error) {
    console.error("[leave] Error:", error);
    throw error;
  }
}
