import { useTranslation } from 'react-i18next';
import { ApiError, type ApiErrorCode } from './transport';

export const FALLBACK_ERROR_KEY = 'unknown';

// Typed as a full record so a new contract code fails the type check until it gets a message.
const keys: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: 'validationError',
  TEXT_TOO_LONG: 'textTooLong',
  UNAUTHENTICATED: 'unauthenticated',
  ANON_QUOTA_USED: 'anonQuotaUsed',
  WALLET_QUOTA_USED: 'walletQuotaUsed',
  BOT_CHECK_FAILED: 'botCheckFailed',
  EXPLANATIONS_USED: 'explanationsUsed',
  OUT_OF_SCOPE: 'outOfScope',
  INTERPRETATION_NOT_READY: 'interpretationNotReady',
  INTERPRETATION_CURATED: 'interpretationCurated',
  WALLET_MISMATCH: 'walletMismatch',
  NOT_FOUND: 'notFound',
  IDEMPOTENCY_CONFLICT: 'idempotencyConflict',
  OPERATION_IN_PROGRESS: 'operationInProgress',
  QUOTE_EXPIRED: 'quoteExpired',
  MATERIAL_CHANGE: 'materialChange',
  PLAN_INVALID: 'planInvalid',
  INSTRUMENT_NOT_APPROVED: 'instrumentNotApproved',
  INSTRUMENT_RESTRICTED: 'instrumentRestricted',
  INSTRUMENT_SUSPENDED: 'instrumentSuspended',
  NO_ROUTE: 'noRoute',
  INSUFFICIENT_BALANCE: 'insufficientBalance',
  TRANSACTION_REJECTED: 'transactionRejected',
  RATE_LIMITED: 'rateLimited',
  AI_UNAVAILABLE: 'aiUnavailable',
  UPSTREAM_UNAVAILABLE: 'upstreamUnavailable',
  INTERNAL_ERROR: 'internalError',
  NETWORK_ERROR: 'networkError',
  UNKNOWN_ERROR: FALLBACK_ERROR_KEY,
};

export const ERROR_CODES = Object.keys(keys) as ApiErrorCode[];

/** i18n key (namespace `errors`) for an error code; unknown codes get the fallback. */
export function errorMessageKey(code: string): string {
  return (keys as Record<string, string>)[code] ?? FALLBACK_ERROR_KEY;
}

/** Turns any thrown value into calm on-screen copy; never shows the API's own message text. */
export function useErrorMessage(): (err: unknown) => string {
  const { t } = useTranslation('errors');
  return (err) => {
    if (!(err instanceof ApiError)) return t(FALLBACK_ERROR_KEY);
    const options: Record<string, unknown> = { ...err.details };
    if (err.retryAfter !== undefined) options.seconds = err.retryAfter;
    return t(errorMessageKey(err.code), options);
  };
}
