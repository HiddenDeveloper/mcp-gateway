/**
 * Mesh Service Configuration
 *
 * Simple file-based message store for AI-to-AI communication.
 * Can be upgraded to Redis for production use.
 */

import { join } from "path";

export const config = {
  dataDir: process.env.MESH_DATA_DIR || "./data/mesh",
  sessionId: process.env.MESH_SESSION_ID || `session-${Date.now()}`,
  maxMessages: parseInt(process.env.MESH_MAX_MESSAGES || "1000"),
};

export interface MeshMessage {
  id: string;
  from: string;
  to: string; // session ID or "ALL"
  content: string;
  timestamp: string;
  read: boolean;
}

interface MessageStore {
  messages: MeshMessage[];
}

const messagesPath = join(config.dataDir, "messages.json");

async function ensureDataDir(): Promise<void> {
  const dir = Bun.file(config.dataDir);
  try {
    await Bun.write(join(config.dataDir, ".keep"), "");
  } catch {
    // Directory might already exist
  }
}

export async function loadMessages(): Promise<MeshMessage[]> {
  await ensureDataDir();
  const file = Bun.file(messagesPath);

  if (await file.exists()) {
    try {
      const store: MessageStore = await file.json();
      return store.messages || [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function saveMessages(messages: MeshMessage[]): Promise<void> {
  await ensureDataDir();
  // Keep only the most recent messages
  const trimmed = messages.slice(-config.maxMessages);
  await Bun.write(messagesPath, JSON.stringify({ messages: trimmed }, null, 2));
}

export function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
