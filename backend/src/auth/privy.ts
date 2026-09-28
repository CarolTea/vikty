import { PrivyClient, type User } from '@privy-io/node';
import type { Redis } from 'ioredis';
import { ApiError } from '../errors.js';

// Turns a Privy access token into the Solana wallet address that signed in.
// Throws ApiError 401 when the token is invalid; 503 when Privy cannot be reached.
export interface WalletResolver {
  resolve(accessToken: string): Promise<string>;
}

const CACHE_TTL_SECONDS = 300;

export class PrivyWalletResolver implements WalletResolver {
  constructor(
    private readonly privy: PrivyClient,
    private readonly redis: Redis,
  ) {}

  async resolve(accessToken: string): Promise<string> {
    let userId: string;
    try {
      ({ user_id: userId } = await this.privy.utils().auth().verifyAccessToken(accessToken));
    } catch {
      throw unauthenticated();
    }

    const cacheKey = `privy:wallet:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    let user: User;
    try {
      user = await this.privy.users()._get(userId);
    } catch {
      throw new ApiError(503, 'UPSTREAM_UNAVAILABLE', 'Sign-in is temporarily unavailable. Try again in a moment.');
    }

    const address = pickSolanaWallet(user);
    if (!address) throw unauthenticated();

    await this.redis.set(cacheKey, address, 'EX', CACHE_TTL_SECONDS);
    return address;
  }
}

// The app only allows external Solana wallets, so a user has exactly one. Anything else
// (none, embedded, or several) is refused rather than guessed.
export function pickSolanaWallet(user: Pick<User, 'linked_accounts'>): string | null {
  const wallets = user.linked_accounts.filter(
    (a) =>
      a.type === 'wallet' &&
      'chain_type' in a &&
      a.chain_type === 'solana' &&
      !('connector_type' in a && a.connector_type === 'embedded') &&
      !('wallet_client_type' in a && a.wallet_client_type === 'privy'),
  );
  if (wallets.length !== 1) return null;
  const [wallet] = wallets;
  return wallet && 'address' in wallet ? wallet.address : null;
}

function unauthenticated(): ApiError {
  return new ApiError(401, 'UNAUTHENTICATED', 'Your session has expired. Connect your wallet again.');
}
