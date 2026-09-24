// Error codes from the `Error` schema in Docs/api/openapi.yaml. The frontend branches on `code`;
// `message` is English and ready to show on screen.
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'TEXT_TOO_LONG'
  | 'UNAUTHENTICATED'
  | 'ANON_QUOTA_USED'
  | 'WALLET_QUOTA_USED'
  | 'BOT_CHECK_FAILED'
  | 'WALLET_MISMATCH'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'OPERATION_IN_PROGRESS'
  | 'QUOTE_EXPIRED'
  | 'MATERIAL_CHANGE'
  | 'ACTIVE_PLAN_EXISTS'
  | 'PLAN_INVALID'
  | 'INSTRUMENT_NOT_APPROVED'
  | 'INSTRUMENT_RESTRICTED'
  | 'INSTRUMENT_SUSPENDED'
  | 'NO_ROUTE'
  | 'INSUFFICIENT_BALANCE'
  | 'TRANSACTION_REJECTED'
  | 'RATE_LIMITED'
  | 'AI_UNAVAILABLE'
  | 'UPSTREAM_UNAVAILABLE'
  // Not in the contract yet: unexpected server failure.
  | 'INTERNAL_ERROR';

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    retryAfter?: number | null;
    details?: Record<string, unknown>;
  };
}

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  toBody(): ErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.retryAfter !== undefined && { retryAfter: this.retryAfter }),
        ...(this.details && { details: this.details }),
      },
    };
  }
}
