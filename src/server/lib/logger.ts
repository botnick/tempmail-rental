type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  userId?: string;
  action?: string;
  [key: string]: unknown;
}

// Fields that must NEVER be logged
const REDACTED_FIELDS = new Set([
  'password',
  'passwordHash',
  'token',
  'refreshToken',
  'sessionToken',
  'secret',
  'totpSecret',
  'creditCard',
  'ssn',
  'apiKey',
]);

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (REDACTED_FIELDS.has(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = redact(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  const configuredLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  return LOG_LEVELS[level] >= LOG_LEVELS[configuredLevel];
}

function formatLog(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? redact(context as Record<string, unknown>) : {}),
  };

  return JSON.stringify(entry);
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (shouldLog('debug')) {
      console.debug(formatLog('debug', message, context));
    }
  },
  info(message: string, context?: LogContext) {
    if (shouldLog('info')) {
      console.info(formatLog('info', message, context));
    }
  },
  warn(message: string, context?: LogContext) {
    if (shouldLog('warn')) {
      console.warn(formatLog('warn', message, context));
    }
  },
  error(message: string, context?: LogContext & { error?: Error }) {
    if (shouldLog('error')) {
      const ctx = context
        ? {
            ...context,
            ...(context.error
              ? { errorMessage: context.error.message, stack: context.error.stack }
              : {}),
          }
        : undefined;
      console.error(formatLog('error', message, ctx));
    }
  },
};
