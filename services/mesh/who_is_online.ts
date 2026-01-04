/**
 * Who Is Online
 *
 * Get list of currently active participants in the mesh network.
 */

import { getOnlineParticipants, updateHeartbeat } from "./lib/config";

interface Params {
  sessionId?: string;
}

export default async function (params: Record<string, unknown>) {
  const { sessionId } = params as Params;

  try {
    // Update heartbeat if session provided
    if (sessionId) {
      await updateHeartbeat(sessionId);
    }

    // Get all online participants
    const participants = await getOnlineParticipants();

    return {
      participants,
      count: participants.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[who_is_online] Error:", error);
    throw error;
  }
}
