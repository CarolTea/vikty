import type { Redis } from 'ioredis';

// Counters live in Redis. The interpretation route reserves them (INCR + EXPIRE) and gives the
// reservation back when the interpretation fails; GET /session only reads. Keep the key format here
// so both sides agree.
export const quotaKeys = {
  // Free interpretation before any wallet: one per anonymous session, 24h TTL set on first use.
  anonymous: (sessionId: string) => `quota:anon:${sessionId}`,
  // Per-wallet interpretations, one counter per UTC day.
  wallet: (address: string, day: string) => `quota:wallet:${address}:${day}`,
};

export const ANON_FREE_INTERPRETATIONS = 1;

const ANON_TTL_SECONDS = 60 * 60 * 24; // 24h after first use
// The day key only matters until midnight UTC; two days covers any clock skew.
const WALLET_TTL_SECONDS = 60 * 60 * 48;

export interface QuotaStore {
  anonymousUsed(sessionId: string): Promise<number>;
  walletUsed(address: string, day: string): Promise<number>;
  // Count one use and return the new total. The caller compares it with the limit and calls
  // release() when over it or when the interpretation fails, so a failure never costs quota.
  reserveAnonymous(sessionId: string): Promise<number>;
  releaseAnonymous(sessionId: string): Promise<void>;
  reserveWallet(address: string, day: string): Promise<number>;
  releaseWallet(address: string, day: string): Promise<void>;
}

// DECR only if the key still exists: after it expires, a release must not leave a -1 behind.
const RELEASE_SCRIPT = "if redis.call('EXISTS', KEYS[1]) == 1 then return redis.call('DECR', KEYS[1]) end return 0";

export class RedisQuotaStore implements QuotaStore {
  constructor(private readonly redis: Redis) {}

  anonymousUsed(sessionId: string): Promise<number> {
    return this.read(quotaKeys.anonymous(sessionId));
  }

  walletUsed(address: string, day: string): Promise<number> {
    return this.read(quotaKeys.wallet(address, day));
  }

  reserveAnonymous(sessionId: string): Promise<number> {
    return this.reserve(quotaKeys.anonymous(sessionId), ANON_TTL_SECONDS);
  }

  async releaseAnonymous(sessionId: string): Promise<void> {
    await this.redis.eval(RELEASE_SCRIPT, 1, quotaKeys.anonymous(sessionId));
  }

  reserveWallet(address: string, day: string): Promise<number> {
    return this.reserve(quotaKeys.wallet(address, day), WALLET_TTL_SECONDS);
  }

  async releaseWallet(address: string, day: string): Promise<void> {
    await this.redis.eval(RELEASE_SCRIPT, 1, quotaKeys.wallet(address, day));
  }

  private async read(key: string): Promise<number> {
    const value = await this.redis.get(key);
    return value === null ? 0 : Number.parseInt(value, 10);
  }

  // INCR and EXPIRE NX in one transaction: two simultaneous requests never both see the free slot,
  // and the TTL is set on first use only.
  private async reserve(key: string, ttlSeconds: number): Promise<number> {
    const results = await this.redis.multi().incr(key).expire(key, ttlSeconds, 'NX').exec();
    const [incrErr, count] = results?.[0] ?? [new Error('empty MULTI result'), null];
    if (incrErr) throw incrErr;
    return Number(count);
  }
}

// UTC day window: "2026-09-24" and the instant it resets.
export function quotaWindow(now: Date): { day: string; resetsAt: string } {
  const day = now.toISOString().slice(0, 10);
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return { day, resetsAt: next.toISOString().replace('.000Z', 'Z') };
}

// `Quota` in the contract.
export const quotaSchema = {
  type: 'object',
  required: ['limit', 'remaining', 'resetsAt'],
  properties: {
    limit: { type: 'integer' },
    remaining: { type: 'integer' },
    resetsAt: { type: 'string', format: 'date-time' },
  },
} as const;
