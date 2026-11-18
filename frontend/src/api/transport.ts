import type { components } from './schema';

/** Error codes defined by the contract, plus two raised only by the client itself. */
export type ContractErrorCode = components['schemas']['Error']['error']['code'];
export type ApiErrorCode = ContractErrorCode | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Privy access token; sent as a bearer token on wallet routes. */
  token?: string;
  /** Mock transport only: name of the contract's named example to serve (defaults to the first). */
  mockExample?: string;
  /** Sent as the Idempotency-Key header. */
  idempotencyKey?: string;
}

/** The only seam between the app and the backend: the real one and the mock both implement it. */
export interface Transport {
  request<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<T>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: Record<string, unknown>;
  readonly retryAfter?: number;

  constructor(init: {
    status: number;
    code: ApiErrorCode;
    message?: string;
    details?: Record<string, unknown>;
    retryAfter?: number;
  }) {
    super(init.message ?? init.code);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.retryAfter = init.retryAfter;
  }
}

type ErrorEnvelope = components['schemas']['Error'];

/** Builds an ApiError from a contract error body; falls back to UNKNOWN_ERROR for anything else. */
export function apiErrorFromBody(status: number, body: unknown, retryAfterHeader?: string | null): ApiError {
  const error = (body as Partial<ErrorEnvelope> | null)?.error;
  if (!error || typeof error.code !== 'string') return new ApiError({ status, code: 'UNKNOWN_ERROR' });
  const headerSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;
  return new ApiError({
    status,
    code: error.code,
    message: error.message,
    details: error.details,
    retryAfter: error.retryAfter ?? (Number.isFinite(headerSeconds) ? headerSeconds : undefined),
  });
}
