import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '../errors.js';

export const SESSION_COOKIE = 'victy_session';
// Same window as the anonymous quota (24h), renewed on every visit so the cookie never expires
// while the quota counter is still running.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours

// A valid signed cookie keeps its session (and gets 24h more); a missing or tampered one gets a
// fresh session.
export function readOrCreateSession(request: FastifyRequest, reply: FastifyReply, secure: boolean): string {
  let sessionId: string | null = null;
  const raw = request.cookies[SESSION_COOKIE];
  if (raw) {
    const { valid, value } = request.unsignCookie(raw);
    if (valid && value) sessionId = value;
  }
  sessionId ??= randomBytes(32).toString('base64url');

  reply.setCookie(SESSION_COOKIE, sessionId, {
    signed: true,
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return sessionId;
}

// The session id works like a password, so the database only keeps its hash.
export function sessionHash(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex');
}

// No header → anonymous. A header that is not a proper bearer token is a client bug: 401.
export function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (header === undefined) return null;
  const match = /^Bearer ([A-Za-z0-9._~+/=-]+)$/.exec(header);
  if (!match?.[1]) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has expired. Connect your wallet again.');
  }
  return match[1];
}

// Who is asking: the anonymous session and, when signed in, the wallet.
export interface Owner {
  sessionHash: string;
  wallet: string | null;
}

// A resource is visible to the session that created it, or to the wallet it belongs to. A
// different wallet never sees it, even from the same browser. Anything else answers 404 (contract).
export function canAccess(resource: Owner, owner: Owner): boolean {
  if (resource.wallet !== null && owner.wallet !== null && resource.wallet !== owner.wallet) return false;
  return resource.sessionHash === owner.sessionHash || (resource.wallet !== null && resource.wallet === owner.wallet);
}
