/**
 * Mesh Service Configuration
 *
 * Data model matching Stone Monkey's ai-mesh-mcp implementation.
 * Uses file-based storage (can be upgraded to Redis for production).
 */

import { join } from "path";

// =============================================================================
// Configuration
// =============================================================================

export const config = {
  dataDir: process.env.MESH_DATA_DIR || "./data/mesh",
  sessionId: process.env.MESH_SESSION_ID || `session-${Date.now()}`,
  participantName: process.env.MESH_PARTICIPANT_NAME || "anonymous",
  maxMessages: parseInt(process.env.MESH_MAX_MESSAGES || "1000"),
  sessionTTL: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  messageTTL: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

// =============================================================================
// Types (matching Stone Monkey's types.ts)
// =============================================================================

export type MessageType =
  | "thought_share"
  | "query"
  | "response"
  | "acknowledgment"
  | "system_notification";

export type PriorityLevel = "low" | "medium" | "high" | "urgent";

export type SessionStatus = "active" | "dormant" | "archived";

export interface MeshMessage {
  id: string;
  fromSession: string;
  toSession: string; // "ALL" for broadcast or specific session_id
  messageType: MessageType;
  content: string;
  context?: Record<string, unknown>;
  priority: PriorityLevel;
  timestamp: string;
  requiresResponse: boolean;
  participantName?: string;
  originalMessageId?: string; // For threading/replies
  readBy: string[]; // Session IDs that read this
}

export interface SessionInfo {
  sessionId: string;
  participantName: string;
  capabilities?: string[];
  messageTypes?: MessageType[];
  priorities?: PriorityLevel[];
  status: SessionStatus;
  lastHeartbeat: string;
  createdAt: string;
}

interface MessageStore {
  messages: MeshMessage[];
}

interface SessionStore {
  sessions: Record<string, SessionInfo>;
}

// =============================================================================
// File paths
// =============================================================================

const messagesPath = join(config.dataDir, "messages.json");
const sessionsPath = join(config.dataDir, "sessions.json");

// =============================================================================
// Utility functions
// =============================================================================

async function ensureDataDir(): Promise<void> {
  try {
    await Bun.write(join(config.dataDir, ".keep"), "");
  } catch {
    // Directory might already exist
  }
}

export function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// =============================================================================
// Message persistence
// =============================================================================

export async function loadMessages(): Promise<MeshMessage[]> {
  await ensureDataDir();
  const file = Bun.file(messagesPath);

  if (await file.exists()) {
    try {
      const store: MessageStore = await file.json();
      // Filter out expired messages
      const now = Date.now();
      return (store.messages || []).filter((msg) => {
        const msgTime = new Date(msg.timestamp).getTime();
        return now - msgTime < config.messageTTL;
      });
    } catch {
      return [];
    }
  }
  return [];
}

export async function saveMessages(messages: MeshMessage[]): Promise<void> {
  await ensureDataDir();
  // Keep only the most recent messages within TTL
  const trimmed = messages.slice(-config.maxMessages);
  await Bun.write(messagesPath, JSON.stringify({ messages: trimmed }, null, 2));
}

export async function storeMessage(message: MeshMessage): Promise<void> {
  const messages = await loadMessages();
  messages.push(message);
  await saveMessages(messages);
}

export async function markAsRead(
  messageId: string,
  sessionId: string
): Promise<boolean> {
  const messages = await loadMessages();
  const message = messages.find((m) => m.id === messageId);

  if (message && !message.readBy.includes(sessionId)) {
    message.readBy.push(sessionId);
    await saveMessages(messages);
    return true;
  }
  return false;
}

export async function deleteMessage(messageId: string): Promise<boolean> {
  const messages = await loadMessages();
  const index = messages.findIndex((m) => m.id === messageId);

  if (index !== -1) {
    messages.splice(index, 1);
    await saveMessages(messages);
    return true;
  }
  return false;
}

export async function getThread(rootMessageId: string): Promise<MeshMessage[]> {
  const messages = await loadMessages();
  return messages
    .filter(
      (m) => m.id === rootMessageId || m.originalMessageId === rootMessageId
    )
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
}

export interface MessageQuery {
  toSession?: string;
  fromSession?: string;
  unreadOnly?: boolean;
  sessionId?: string; // For unread checking
  messageType?: MessageType;
  priority?: PriorityLevel;
  limit?: number;
  includeRead?: boolean;
}

export async function queryMessages(
  query: MessageQuery
): Promise<MeshMessage[]> {
  let messages = await loadMessages();

  // Filter by recipient
  if (query.toSession) {
    messages = messages.filter(
      (m) => m.toSession === query.toSession || m.toSession === "ALL"
    );
  }

  // Filter by sender
  if (query.fromSession) {
    messages = messages.filter((m) => m.fromSession === query.fromSession);
  }

  // Filter by message type
  if (query.messageType) {
    messages = messages.filter((m) => m.messageType === query.messageType);
  }

  // Filter by priority
  if (query.priority) {
    messages = messages.filter((m) => m.priority === query.priority);
  }

  // Filter unread only
  if (query.unreadOnly && query.sessionId) {
    messages = messages.filter((m) => !m.readBy.includes(query.sessionId));
  }

  // Sort by timestamp descending (newest first)
  messages.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Apply limit
  if (query.limit && query.limit > 0) {
    messages = messages.slice(0, query.limit);
  }

  return messages;
}

// =============================================================================
// Session persistence
// =============================================================================

export async function loadSessions(): Promise<Record<string, SessionInfo>> {
  await ensureDataDir();
  const file = Bun.file(sessionsPath);

  if (await file.exists()) {
    try {
      const store: SessionStore = await file.json();
      // Filter out expired sessions
      const now = Date.now();
      const sessions: Record<string, SessionInfo> = {};
      for (const [id, session] of Object.entries(store.sessions || {})) {
        const lastHeartbeat = new Date(session.lastHeartbeat).getTime();
        if (now - lastHeartbeat < config.sessionTTL) {
          sessions[id] = session;
        }
      }
      return sessions;
    } catch {
      return {};
    }
  }
  return {};
}

export async function saveSessions(
  sessions: Record<string, SessionInfo>
): Promise<void> {
  await ensureDataDir();
  await Bun.write(sessionsPath, JSON.stringify({ sessions }, null, 2));
}

export async function getOrCreateSession(
  participantName: string,
  capabilities?: string[],
  messageTypes?: MessageType[],
  priorities?: PriorityLevel[]
): Promise<SessionInfo> {
  const sessions = await loadSessions();

  // Find existing session by participant name
  for (const session of Object.values(sessions)) {
    if (session.participantName === participantName) {
      // Update heartbeat and return
      session.lastHeartbeat = new Date().toISOString();
      session.status = "active";
      if (capabilities) session.capabilities = capabilities;
      if (messageTypes) session.messageTypes = messageTypes;
      if (priorities) session.priorities = priorities;
      await saveSessions(sessions);
      return session;
    }
  }

  // Create new session
  const sessionId = generateSessionId();
  const session: SessionInfo = {
    sessionId,
    participantName,
    capabilities,
    messageTypes,
    priorities,
    status: "active",
    lastHeartbeat: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  sessions[sessionId] = session;
  await saveSessions(sessions);
  return session;
}

export async function getSession(
  sessionId: string
): Promise<SessionInfo | null> {
  const sessions = await loadSessions();
  return sessions[sessionId] || null;
}

export async function updateHeartbeat(sessionId: string): Promise<boolean> {
  const sessions = await loadSessions();
  if (sessions[sessionId]) {
    sessions[sessionId].lastHeartbeat = new Date().toISOString();
    sessions[sessionId].status = "active";
    await saveSessions(sessions);
    return true;
  }
  return false;
}

export async function leaveSession(sessionId: string): Promise<boolean> {
  const sessions = await loadSessions();
  if (sessions[sessionId]) {
    sessions[sessionId].status = "archived";
    await saveSessions(sessions);
    return true;
  }
  return false;
}

export async function getActiveSessions(): Promise<SessionInfo[]> {
  const sessions = await loadSessions();
  return Object.values(sessions).filter((s) => s.status === "active");
}

export async function getOnlineParticipants(): Promise<
  Array<{ sessionId: string; participantName: string; capabilities?: string[] }>
> {
  const active = await getActiveSessions();
  return active.map((s) => ({
    sessionId: s.sessionId,
    participantName: s.participantName,
    capabilities: s.capabilities,
  }));
}
