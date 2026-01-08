/**
 * WebSocket client for connecting to Ailumina server
 * Ported from bridge_logic for standalone gateway implementation.
 */

import WebSocket from 'ws';
import { AILUMINA_SERVER_URL } from './config';

export interface AiluminaMessage {
  user_input: string;
  chat_messages: any[];
  fileId?: string;
}

export interface AiluminaResponse {
  type?: string;
  content?: string;
  sentence?: string;
  tool_name?: string;
  tool_status?: string;
  error?: string;
  role?: string;
  done?: boolean;
  [key: string]: any;
}

export interface WebSocketClientOptions {
  serverUrl?: string;
  timeout?: number;
}

export class AiluminaWebSocketClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private timeout: number;
  private isConnected = false;
  private responseContent = '';

  constructor(options: WebSocketClientOptions = {}) {
    this.serverUrl = options.serverUrl || AILUMINA_SERVER_URL;
    this.timeout = options.timeout || 300000;
  }

  async connect(agentType: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const agentPath = agentType === 'ailumina' ? 'AIlumina' : agentType;
        const url = `${this.serverUrl}/ws/${agentPath}`;
        
        console.log(`[WebSocket] Connecting to ${url}`);

        this.ws = new WebSocket(url);

        const connectionTimeout = setTimeout(() => {
          reject(new Error(`Connection timeout after ${this.timeout}ms`));
          this.cleanup();
        }, this.timeout);

        this.ws.on('open', () => {
          console.log('[WebSocket] Connected successfully');
          clearTimeout(connectionTimeout);
          this.isConnected = true;
          resolve();
        });

        this.ws.on('error', (error: Error) => {
          console.error('[WebSocket] Connection error:', error);
          clearTimeout(connectionTimeout);
          reject(error);
        });

        this.ws.on('close', () => {
          console.log('[WebSocket] Connection closed');
          this.isConnected = false;
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  async sendChatMessage(message: AiluminaMessage): Promise<string> {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      this.responseContent = '';
      
      const responseTimeout = setTimeout(() => {
        reject(new Error(`Response timeout after ${this.timeout}ms`));
      }, this.timeout);

      this.ws!.on('message', (data: any) => {
        try {
          const response: AiluminaResponse = JSON.parse(data.toString());
          
          if (response.done === true) {
            clearTimeout(responseTimeout);
            resolve(this.responseContent.trim());
            return;
          }

          if (response.sentence) {
            this.responseContent += response.sentence;
          }

          if (response.type === 'complete') {
            clearTimeout(responseTimeout);
            resolve(this.responseContent.trim());
            return;
          }

          if (response.type === 'error') {
            clearTimeout(responseTimeout);
            reject(new Error(response.error || 'Unknown error from Ailumina'));
            return;
          }

        } catch (error) {
          console.error('[WebSocket] Failed to parse response:', error);
        }
      });

      try {
        this.ws!.send(JSON.stringify(message));
      } catch (error) {
        clearTimeout(responseTimeout);
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }
    this.isConnected = false;
  }
}

export async function executeAiluminaChat(
  agentType: string,
  userInput: string,
  chatMessages: any[] = []
): Promise<string> {
  const client = new AiluminaWebSocketClient();
  
  try {
    await client.connect(agentType);
    const response = await client.sendChatMessage({
      user_input: userInput,
      chat_messages: chatMessages
    });
    return response;
  } finally {
    client.disconnect();
  }
}
