/**
 * Simple logger with levels for MCP tools
 *
 * All output goes to stderr (required for MCP - stdout is for JSON-RPC)
 * but with level prefixes so errors can be filtered: grep "\[ERROR\]"
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getLogLevel(): LogLevel {
  const level = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel;
  return LOG_LEVELS[level] !== undefined ? level : 'info';
}

function shouldLog(level: LogLevel): boolean {
  const currentLevel = getLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(level: LogLevel, prefix: string, ...args: unknown[]): string {
  const timestamp = formatTimestamp();
  const levelTag = `[${level.toUpperCase()}]`;
  const prefixTag = prefix ? `[${prefix}]` : '';
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');

  return `${timestamp} ${levelTag}${prefixTag} ${message}`;
}

export function createLogger(prefix: string) {
  return {
    debug(...args: unknown[]) {
      if (shouldLog('debug')) {
        console.error(formatMessage('debug', prefix, ...args));
      }
    },

    info(...args: unknown[]) {
      if (shouldLog('info')) {
        console.error(formatMessage('info', prefix, ...args));
      }
    },

    warn(...args: unknown[]) {
      if (shouldLog('warn')) {
        console.error(formatMessage('warn', prefix, ...args));
      }
    },

    error(...args: unknown[]) {
      if (shouldLog('error')) {
        console.error(formatMessage('error', prefix, ...args));
      }
    },
  };
}

// Default logger for quick use
export const logger = createLogger('Bridge');
