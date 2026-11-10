import { randomBytes } from 'node:crypto';
import type { Db } from './db/index.js';
import type { LabeledItem } from './interpretations.js';
import type { StoredItem } from './proposals.js';

// What the session needs to know about a wallet's plans and in-flight operations.
export interface PlanLookup {
  activePlanId(wallet: string): Promise<string | null>;
  activeOperationIds(wallet: string): Promise<string[]>;
}

export type PlanStatus = 'draft' | 'active';

// A saved composition, owned by a wallet. A wallet can have several, like the demo's saved theses.
export interface PlanRecord {
  id: string;
  wallet: string;
  proposalId: string;
  interpretationSummary: string;
  status: PlanStatus;
  // Starts at 1; every PUT adds one. Activation doesn't change the composition, so it doesn't.
  version: number;
  budgetUsdc: string;
  // Every item of the proposal, with this plan's weights and states: edits are checked against them.
  items: StoredItem[];
  exposures: LabeledItem[];
  excludedInstrumentIds: string[];
  trackedMints: string[];
  confirmPreexistingBalances: boolean;
  createdAt: string;
  updatedAt: string;
}

export function newPlanId(): string {
  return `plan_${randomBytes(12).toString('base64url')}`;
}

export interface PlanStore extends PlanLookup {
  create(record: PlanRecord): Promise<void>;
  get(id: string): Promise<PlanRecord | null>;
  // Most recently updated first.
  listByWallet(wallet: string): Promise<PlanRecord[]>;
  // Saves `record` if the stored version is still `expectedVersion`; false when someone got there
  // first. Scope changes (activation) are also recorded in plan_scope_changes.
  update(record: PlanRecord, expectedVersion: number, scopeChanged: boolean): Promise<boolean>;
}

interface PlanRow {
  id: string;
  wallet: string;
  proposal_id: string;
  interpretation_summary: string;
  status: PlanStatus;
  version: number;
  budget_usdc: string;
  items: StoredItem[];
  exposures: LabeledItem[];
  excluded_instrument_ids: string[];
  tracked_mints: string[];
  confirm_preexisting_balances: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export class PgPlanStore implements PlanStore {
  constructor(private readonly db: Db) {}

  async create(r: PlanRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO plans
         (id, wallet, proposal_id, interpretation_summary, status, version, budget_usdc, items, exposures,
          excluded_instrument_ids, tracked_mints, confirm_preexisting_balances, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        r.id,
        r.wallet,
        r.proposalId,
        r.interpretationSummary,
        r.status,
        r.version,
        r.budgetUsdc,
        JSON.stringify(r.items),
        JSON.stringify(r.exposures),
        JSON.stringify(r.excludedInstrumentIds),
        JSON.stringify(r.trackedMints),
        r.confirmPreexistingBalances,
        r.createdAt,
        r.updatedAt,
      ],
    );
  }

  async get(id: string): Promise<PlanRecord | null> {
    const [row] = await this.db.query<PlanRow>('SELECT * FROM plans WHERE id = $1', [id]);
    return row ? fromRow(row) : null;
  }

  async listByWallet(wallet: string): Promise<PlanRecord[]> {
    const rows = await this.db.query<PlanRow>('SELECT * FROM plans WHERE wallet = $1 ORDER BY updated_at DESC, id', [wallet]);
    return rows.map(fromRow);
  }

  async update(r: PlanRecord, expectedVersion: number, scopeChanged: boolean): Promise<boolean> {
    // One statement, so the plan and its scope history change together or not at all.
    const rows = await this.db.query<{ id: string }>(
      `WITH saved AS (
         UPDATE plans
            SET status = $3, version = $4, budget_usdc = $5, items = $6, tracked_mints = $7,
                confirm_preexisting_balances = $8, updated_at = $9
          WHERE id = $1 AND version = $2
         RETURNING id
       ), scope AS (
         INSERT INTO plan_scope_changes (plan_id, tracked_mints, confirm_preexisting_balances, created_at)
         SELECT id, $7, $8, $9 FROM saved WHERE $10::boolean
       )
       SELECT id FROM saved`,
      [
        r.id,
        expectedVersion,
        r.status,
        r.version,
        r.budgetUsdc,
        JSON.stringify(r.items),
        JSON.stringify(r.trackedMints),
        r.confirmPreexistingBalances,
        r.updatedAt,
        scopeChanged,
      ],
    );
    return rows.length === 1;
  }

  async activePlanId(wallet: string): Promise<string | null> {
    const [row] = await this.db.query<{ id: string }>(
      `SELECT id FROM plans WHERE wallet = $1 AND status = 'active' ORDER BY updated_at DESC, id LIMIT 1`,
      [wallet],
    );
    return row?.id ?? null;
  }

  // No operations yet (Jupiter routes): nothing is ever in flight.
  async activeOperationIds(): Promise<string[]> {
    return [];
  }
}

function fromRow(row: PlanRow): PlanRecord {
  return {
    id: row.id,
    wallet: row.wallet,
    proposalId: row.proposal_id,
    interpretationSummary: row.interpretation_summary,
    status: row.status,
    version: row.version,
    budgetUsdc: row.budget_usdc,
    items: row.items,
    exposures: row.exposures,
    excludedInstrumentIds: row.excluded_instrument_ids,
    trackedMints: row.tracked_mints,
    confirmPreexistingBalances: row.confirm_preexisting_balances,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
