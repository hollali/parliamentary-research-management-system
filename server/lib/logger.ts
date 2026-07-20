type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  route?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  error?: unknown;
  timestamp: string;
}

function formatEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
    entry.method && entry.route ? `${entry.method} ${entry.route}` : '',
    entry.statusCode ? `→ ${entry.statusCode}` : '',
    entry.userId ? `user=${entry.userId}` : '',
    entry.message,
  ].filter(Boolean);
  return parts.join(' ');
}

export const logger = {
  info(message: string, meta?: Partial<LogEntry>) {
    const entry: LogEntry = { level: 'info', message, timestamp: new Date().toISOString(), ...meta };
    console.log(formatEntry(entry));
  },

  warn(message: string, meta?: Partial<LogEntry>) {
    const entry: LogEntry = { level: 'warn', message, timestamp: new Date().toISOString(), ...meta };
    console.warn(formatEntry(entry));
  },

  error(message: string, meta?: Partial<LogEntry>) {
    const entry: LogEntry = { level: 'error', message, timestamp: new Date().toISOString(), ...meta };
    console.error(formatEntry(entry));
    if (meta?.error) {
      console.error(meta.error);
    }
  },

  requestError(method: string, route: string, error: unknown, userId?: string) {
    const message = error instanceof Error ? error.message : String(error);
    this.error(message, { method, route, userId, error });
  },
};
