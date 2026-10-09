import { randomBytes } from 'node:crypto';
import type { ItemState } from './composition.js';
import type { Db } from './db/index.js';
import type { LabeledItem } from './interpretations.js';

// What a proposal keeps per instrument. Symbol, mint, issuer and risks come from the registry when
// the proposal is served, so a correction there reaches every proposal.
export interface StoredItem {
  instrumentId: string;
  exposureIds: string[];
  weightBps: number;
  rationale: string;
  state: ItemState;
}

// The composition part of a proposal: what the AI (or the curation) decided, independent of budget.
export interface Composition {
  items: StoredItem[];
  excludedInstrumentIds: string[];
  limitations: string[];
}

export interface ProposalRecord extends Composition {
  id: string;
  interpretationId: string;
  sessionHash: string;
  wallet: string | null;
  curated: boolean;
  budgetUsdc: string;
  exposures: LabeledItem[];
}

export function newProposalId(): string {
  return `prop_${randomBytes(12).toString('base64url')}`;
}

export interface ProposalStore {
  create(record: ProposalRecord): Promise<void>;
  get(id: string): Promise<ProposalRecord | null>;
  // The most recent proposal for an interpretation, to reuse its composition with a new budget.
  latestFor(interpretationId: string): Promise<ProposalRecord | null>;
}

interface ProposalRow {
  id: string;
  interpretation_id: string;
  session_hash: string;
  wallet: string | null;
  curated: boolean;
  budget_usdc: string;
  items: StoredItem[];
  exposures: LabeledItem[];
  excluded_instrument_ids: string[];
  limitations: string[];
}

export class PgProposalStore implements ProposalStore {
  constructor(private readonly db: Db) {}

  async create(r: ProposalRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO proposals
         (id, interpretation_id, session_hash, wallet, curated, budget_usdc, items, exposures,
          excluded_instrument_ids, limitations)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        r.id,
        r.interpretationId,
        r.sessionHash,
        r.wallet,
        r.curated,
        r.budgetUsdc,
        JSON.stringify(r.items),
        JSON.stringify(r.exposures),
        JSON.stringify(r.excludedInstrumentIds),
        JSON.stringify(r.limitations),
      ],
    );
  }

  async get(id: string): Promise<ProposalRecord | null> {
    const [row] = await this.db.query<ProposalRow>('SELECT * FROM proposals WHERE id = $1', [id]);
    return row ? fromRow(row) : null;
  }

  async latestFor(interpretationId: string): Promise<ProposalRecord | null> {
    const [row] = await this.db.query<ProposalRow>(
      'SELECT * FROM proposals WHERE interpretation_id = $1 ORDER BY created_at DESC LIMIT 1',
      [interpretationId],
    );
    return row ? fromRow(row) : null;
  }
}

function fromRow(row: ProposalRow): ProposalRecord {
  return {
    id: row.id,
    interpretationId: row.interpretation_id,
    sessionHash: row.session_hash,
    wallet: row.wallet,
    curated: row.curated,
    budgetUsdc: row.budget_usdc,
    items: row.items,
    exposures: row.exposures,
    excludedInstrumentIds: row.excluded_instrument_ids,
    limitations: row.limitations,
  };
}
