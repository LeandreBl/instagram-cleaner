export const logLevels = ['silent', 'error', 'warn', 'info', 'debug'] as const;

export type LogLevel = (typeof logLevels)[number];

const logLevelPriority: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

let currentLogLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

export function isLogLevel(value: string): value is LogLevel {
  return logLevels.includes(value as LogLevel);
}

function shouldLog(level: Exclude<LogLevel, 'silent'>): boolean {
  return logLevelPriority[level] <= logLevelPriority[currentLogLevel];
}

function formatMessage(level: Exclude<LogLevel, 'silent'>, message: string): string {
  if (level === 'debug') {
    return `[debug] ${message}`;
  }

  return message;
}

export const logger = {
  debug(message: string): void {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', message));
    }
  },

  error(message: string): void {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message));
    }
  },

  info(message: string): void {
    if (shouldLog('info')) {
      console.log(formatMessage('info', message));
    }
  },

  warn(message: string): void {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message));
    }
  },
};
