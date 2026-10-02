import { ApiError } from '../errors.js';

// Checks the Cloudflare Turnstile token the front sends with an anonymous interpretation.
// Returns false when Cloudflare says no; throws 503 when Cloudflare cannot be reached.
export interface BotCheck {
  verify(token: string, remoteIp: string): Promise<boolean>;
}

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 5_000;

export class TurnstileBotCheck implements BotCheck {
  constructor(
    private readonly secret: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async verify(token: string, remoteIp: string): Promise<boolean> {
    let body: unknown;
    try {
      const res = await this.fetchFn(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret: this.secret, response: token, remoteip: remoteIp }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`siteverify returned ${res.status}`);
      body = await res.json();
    } catch {
      throw new ApiError(503, 'UPSTREAM_UNAVAILABLE', 'We could not verify your request right now. Try again in a moment.');
    }
    return typeof body === 'object' && body !== null && 'success' in body && body.success === true;
  }
}

// Local development without TURNSTILE_SECRET_KEY: every token passes. Production refuses to
// start without the key (config.ts), so this never runs there.
export const skipBotCheck: BotCheck = {
  async verify() {
    return true;
  },
};
