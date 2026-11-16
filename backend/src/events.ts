import type { Db } from './db/index.js';

// Funnel events the front may send (closed list from the contract). Events the backend already
// knows about (proposal created, operation confirmed) are recorded by the backend itself.
export const CLIENT_EVENT_NAMES = [
  'discovery_started',
  'suggested_thesis_selected',
  'interpretation_corrected',
  'asset_rejected',
  'weight_changed',
  'operation_review_started',
] as const;

export type ClientEventName = (typeof CLIENT_EVENT_NAMES)[number];

export interface EventRecord {
  name: ClientEventName;
  occurredAt: string;
  props: Record<string, string | number | boolean>;
  // Pseudonymous owner: hashes only, never the session id or the wallet address.
  sessionHash: string;
  walletHash: string | null;
}

export interface EventStore {
  record(events: EventRecord[]): Promise<void>;
}

export class PgEventStore implements EventStore {
  constructor(private readonly db: Db) {}

  async record(events: EventRecord[]): Promise<void> {
    if (!events.length) return;
    const params: unknown[] = [];
    const rows = events.map((e) => {
      params.push(e.name, e.occurredAt, JSON.stringify(e.props), e.sessionHash, e.walletHash);
      const n = params.length;
      return `($${n - 4}, $${n - 3}, $${n - 2}, $${n - 1}, $${n})`;
    });
    await this.db.query(
      `INSERT INTO events (name, occurred_at, props, session_hash, wallet_hash) VALUES ${rows.join(', ')}`,
      params,
    );
  }
}
