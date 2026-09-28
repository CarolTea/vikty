import type { Redis } from 'ioredis';

// Counters live in Redis. The interpretation route increments them (INCR + EXPIRE); GET /session
// only reads. Keep the key format here so both sides agree.
export const quotaKeys = {
  // Free interpretation before any wallet: one per anonymous session, 24h TTL set on first use.
  anonymous: (sessionId: string) => `quota:anon:${sessionId}`,
  // Per-wallet interpretations, one counter per UTC day.
  wallet: (address: string, day: string) => `quota:wallet:${address}:${day}`,
};

export const ANON_FREE_INTERPRETATIONS = 1;

export interface QuotaStore {
  anonymousUsed(sessionId: string): Promise<number>;
  walletUsed(address: string, day: string): Promise<number>;
}

export class RedisQuotaStore implements QuotaStore {
  constructor(private readonly redis: Redis) {}

  anonymousUsed(sessionId: string): Promise<number> {
    return this.read(quotaKeys.anonymous(sessionId));
  }

  walletUsed(address: string, day: string): Promise<number> {
    return this.read(quotaKeys.wallet(address, day));
  }

  private async read(key: string): Promise<number> {
    const value = await this.redis.get(key);
    return value === null ? 0 : Number.parseInt(value, 10);
  }
}

// UTC day window: "2026-09-24" and the instant it resets.
export function quotaWindow(now: Date): { day: string; resetsAt: string } {
  const day = now.toISOString().slice(0, 10);
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return { day, resetsAt: next.toISOString().replace('.000Z', 'Z') };
}
