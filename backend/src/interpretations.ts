import { randomBytes } from 'node:crypto';
import type { AiInterpretation } from './ai/interpreter.js';
import type { Db } from './db/index.js';

export interface LabeledItem {
  id: string;
  label: string;
}

export interface Ambiguity {
  id: string;
  question: string;
  material: boolean;
  options: LabeledItem[];
  answer: string | null;
}

export type Representation = 'sufficient' | 'partial' | 'insufficient';
export type InterpretationStatus = 'needs_clarification' | 'ready';

// The interpretation fields of the contract's `Interpretation`, without id and owner.
export interface InterpretationContent {
  summary: string;
  exposures: LabeledItem[];
  exclusions: LabeledItem[];
  restrictions: LabeledItem[];
  ambiguities: Ambiguity[];
  representation: Representation;
  limitations: string[];
}

export interface InterpretationRecord extends InterpretationContent {
  id: string;
  sessionHash: string;
  wallet: string | null;
  source: 'free_text' | 'suggested';
  curated: boolean;
  suggestedThesisId: string | null;
  status: InterpretationStatus;
}

export function newInterpretationId(): string {
  return `int_${randomBytes(12).toString('base64url')}`;
}

// Ready only when no material ambiguity is left unanswered (RF-07).
export function statusOf(ambiguities: Ambiguity[]): InterpretationStatus {
  return ambiguities.some((a) => a.material && a.answer === null) ? 'needs_clarification' : 'ready';
}

// The AI gives labels; ids are ours, unique within the interpretation.
export function contentFromAi(ai: AiInterpretation): InterpretationContent {
  const items = (prefix: string, labels: string[]) => labels.map((label, i) => ({ id: `${prefix}_${i + 1}`, label }));
  return {
    summary: ai.summary,
    exposures: items('exp', ai.exposures),
    exclusions: items('exc', ai.exclusions),
    restrictions: items('res', ai.restrictions),
    ambiguities: ai.ambiguities.map((a, i) => ({
      id: `amb_${i + 1}`,
      question: a.question,
      material: a.material,
      options: items('opt', a.options),
      answer: null,
    })),
    representation: ai.representation,
    limitations: ai.limitations,
  };
}

export interface InterpretationStore {
  create(record: InterpretationRecord): Promise<void>;
  get(id: string): Promise<InterpretationRecord | null>;
}

interface InterpretationRow {
  id: string;
  session_hash: string;
  wallet: string | null;
  source: InterpretationRecord['source'];
  curated: boolean;
  suggested_thesis_id: string | null;
  summary: string;
  exposures: LabeledItem[];
  exclusions: LabeledItem[];
  restrictions: LabeledItem[];
  ambiguities: Ambiguity[];
  representation: Representation;
  limitations: string[];
  status: InterpretationStatus;
}

export class PgInterpretationStore implements InterpretationStore {
  constructor(private readonly db: Db) {}

  async create(r: InterpretationRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO interpretations
         (id, session_hash, wallet, source, curated, suggested_thesis_id, summary, exposures,
          exclusions, restrictions, ambiguities, representation, limitations, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        r.id,
        r.sessionHash,
        r.wallet,
        r.source,
        r.curated,
        r.suggestedThesisId,
        r.summary,
        JSON.stringify(r.exposures),
        JSON.stringify(r.exclusions),
        JSON.stringify(r.restrictions),
        JSON.stringify(r.ambiguities),
        r.representation,
        JSON.stringify(r.limitations),
        r.status,
      ],
    );
  }

  async get(id: string): Promise<InterpretationRecord | null> {
    const [row] = await this.db.query<InterpretationRow>('SELECT * FROM interpretations WHERE id = $1', [id]);
    if (!row) return null;
    return {
      id: row.id,
      sessionHash: row.session_hash,
      wallet: row.wallet,
      source: row.source,
      curated: row.curated,
      suggestedThesisId: row.suggested_thesis_id,
      summary: row.summary,
      exposures: row.exposures,
      exclusions: row.exclusions,
      restrictions: row.restrictions,
      ambiguities: row.ambiguities,
      representation: row.representation,
      limitations: row.limitations,
      status: row.status,
    };
  }
}
