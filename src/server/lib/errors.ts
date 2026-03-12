import { TRPCError } from '@trpc/server';

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }

  toTRPCError(): TRPCError {
    const codeMap: Record<number, TRPCError['code']> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
    };

    return new TRPCError({
      code: codeMap[this.statusCode] ?? 'INTERNAL_SERVER_ERROR',
      message: this.message,
      cause: this,
    });
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(
      id ? `${entity} not found` : `${entity} not found`,
      'NOT_FOUND',
      404,
      { entity, id }
    );
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 'RATE_LIMIT_ERROR', 429);
  }
}

export class QuotaExceededError extends AppError {
  constructor(resource: string) {
    super(`Quota exceeded for ${resource}`, 'QUOTA_EXCEEDED', 403);
  }
}

// Anti-enumeration: always return the same message for auth lookups
export class CredentialError extends AppError {
  constructor() {
    super('Invalid email or password', 'CREDENTIAL_ERROR', 401);
  }
}
