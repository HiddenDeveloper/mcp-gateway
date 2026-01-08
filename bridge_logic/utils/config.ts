/**
 * Configuration utilities for Ailumina Bridge system
 */

/**
 * Get HTTP server port for Ailumina Bridge
 */
export const getAiluminaHttpPort = (): number => {
  return parseInt(process.env.AILUMINA_HTTP_PORT || "3004", 10);
};

/**
 * Get HTTP server URL for STDIO wrapper
 */
export const getAiluminaHttpUrl = (): string => {
  return process.env.AILUMINA_HTTP_URL || `http://localhost:${getAiluminaHttpPort()}`;
};

/**
 * Get Ailumina WebSocket server URL
 */
export const getAiluminaWebSocketUrl = (): string => {
  return process.env.AILUMINA_WEBSOCKET_URL || "ws://localhost:8000";
};