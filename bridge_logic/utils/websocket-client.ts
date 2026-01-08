/**
 * WebSocket client utilities for connecting to Ailumina server
 */

import WebSocket from 'ws';
import { createLogger } from './logger.js';

const log = createLogger('WebSocket');

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
  retries?: number;
}

export class AiluminaWebSocketClient {
  private ws: WebSocket | null = null;
  private options: Required<WebSocketClientOptions>;
  private isConnected = false;
  private responseContent = '';

  constructor(options: WebSocketClientOptions = {}) {
    this.options = {
      serverUrl: options.serverUrl || process.env.AILUMINA_SERVER_URL || 'ws://localhost:8000',
      timeout: options.timeout || parseInt(process.env.AILUMINA_TIMEOUT || '300000', 10),
      retries: options.retries || parseInt(process.env.AILUMINA_RETRIES || '3', 10)
    };
  }

  /**
   * Connect to Ailumina WebSocket endpoint
   */
  async connect(agentType: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Handle case-sensitive agent type mapping
        const agentPath = agentType === 'ailumina' ? 'AIlumina' : agentType;
        const url = `${this.options.serverUrl}/ws/${agentPath}`;
        log.info(`Connecting to ${url}`);

        // Add proper headers for WebSocket connection
        const headers = {
          'Origin': this.options.serverUrl.replace('ws://', 'http://').replace('wss://', 'https://'),
          'User-Agent': 'Ailumina-MCP-Client/1.0.0'
        };

        this.ws = new WebSocket(url, { headers });

        const timeout = setTimeout(() => {
          reject(new Error(`Connection timeout after ${this.options.timeout}ms`));
          this.cleanup();
        }, this.options.timeout);

        this.ws.on('open', () => {
          log.info('Connected successfully');
          clearTimeout(timeout);
          this.isConnected = true;
          resolve();
        });

        this.ws.on('error', (error: Error) => {
          log.error('Connection error:', error);
          clearTimeout(timeout);
          reject(error);
        });

        this.ws.on('close', () => {
          log.info('Connection closed');
          this.isConnected = false;
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send a chat message and process responses until completion
   */
  async sendChatMessage(message: AiluminaMessage): Promise<string> {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      this.responseContent = '';
      
      const timeout = setTimeout(() => {
        reject(new Error(`Response timeout after ${this.options.timeout}ms`));
      }, this.options.timeout);

      // Set up message handler
      this.ws!.on('message', (data: Buffer) => {
        try {
          const response: AiluminaResponse = JSON.parse(data.toString());
          log.debug('Received:', response);

          // Check for 'done' field first (Ailumina completion signal)
          if (response.done === true) {
            log.debug('Done signal received');
            clearTimeout(timeout);
            resolve(this.responseContent.trim());
            return;
          }

          // Handle sentence messages (streaming response) - model-agnostic approach
          if (response.sentence) {
            this.responseContent += response.sentence;
            log.debug(`Accumulated sentence: "${response.sentence.substring(0, 100)}..."`);
          }

          // Handle different message types for logging and control flow
          switch (response.type) {
            case 'sentence':
              // Already handled above with response.sentence check
              break;

            case 'tool_running':
              log.debug(`Tool running: ${response.tool_name}`);
              break;

            case 'tool_complete':
              log.debug(`Tool completed: ${response.tool_name}`);
              break;

            case 'complete':
              // Interaction complete - return the accumulated response
              log.info('Interaction complete');
              clearTimeout(timeout);
              resolve(this.responseContent.trim());
              return;

            case 'error':
              log.error('Error from Ailumina:', response.error);
              clearTimeout(timeout);
              reject(new Error(response.error || 'Unknown error from Ailumina'));
              return;
          }

          // Log other message types at debug level
          if (response.role) {
            log.debug(`Received ${response.role} message`);
          }

        } catch (error) {
          log.error('Failed to parse response:', error);
          clearTimeout(timeout);
          reject(new Error(`Failed to parse response: ${error instanceof Error ? error.message : String(error)}`));
        }
      });

      // Send the message
      try {
        const payload = JSON.stringify(message);
        log.debug('Sending message to agent');
        this.ws!.send(payload);
      } catch (error) {
        log.error('Failed to send message:', error);
        clearTimeout(timeout);
        reject(new Error(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  }

  /**
   * Disconnect from the WebSocket
   */
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

  /**
   * Check if the client is connected
   */
  get connected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

/**
 * Utility function to execute a chat request to Ailumina
 */
export async function executeAiluminaChat(
  agentType: string,
  userInput: string,
  chatMessages: any[] = [],
  fileId?: string,
  options?: WebSocketClientOptions
): Promise<string> {
  const client = new AiluminaWebSocketClient(options);
  
  try {
    await client.connect(agentType);
    
    const message: AiluminaMessage = {
      user_input: userInput,
      chat_messages: chatMessages
    };
    
    if (fileId) {
      message.fileId = fileId;
    }
    
    const response = await client.sendChatMessage(message);
    return response;
    
  } finally {
    client.disconnect();
  }
}