import { randomBytes } from 'node:crypto';
import { normalizeText, outOfScope, screenConviction } from './ai/guard.js';
import type { AiInterpretation } from './ai/interpreter.js';
import type { Db } from './db/index.js';
import { ApiError } from './errors.js';

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
  // Starts at 1; every correction adds one.
  version: number;
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
  // Saves a correction made on `record.version - 1`. False when someone else saved one first: the
  // caller re-reads and re-applies instead of overwriting it.
  update(record: InterpretationRecord): Promise<boolean>;
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
  version: number;
}

export class PgInterpretationStore implements InterpretationStore {
  constructor(private readonly db: Db) {}

  async create(r: InterpretationRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO interpretations
         (id, session_hash, wallet, source, curated, suggested_thesis_id, summary, exposures,
          exclusions, restrictions, ambiguities, representation, limitations, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
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
        r.version,
      ],
    );
  }

  async update(r: InterpretationRecord): Promise<boolean> {
    // Only what PATCH can change; summary, representation and limitations stay as interpreted.
    const rows = await this.db.query<{ id: string }>(
      `UPDATE interpretations
          SET exposures = $3, exclusions = $4, restrictions = $5, ambiguities = $6, status = $7,
              version = $2, updated_at = now()
        WHERE id = $1 AND version = $2 - 1
       RETURNING id`,
      [
        r.id,
        r.version,
        JSON.stringify(r.exposures),
        JSON.stringify(r.exclusions),
        JSON.stringify(r.restrictions),
        JSON.stringify(r.ambiguities),
        r.status,
      ],
    );
    return rows.length === 1;
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
      version: row.version,
    };
  }
}

// PATCH /interpretations/{id}: structured corrections, no AI.
export interface InterpretationPatch {
  answers?: { ambiguityId: string; optionId: string }[];
  removeExposureIds?: string[];
  addExclusions?: string[];
  removeExclusionIds?: string[];
  addRestrictions?: string[];
  removeRestrictionIds?: string[];
}

// Same ceiling as the AI's output schema, so a corrected interpretation still fits it.
const MAX_LABELS = 10;

const STRUCTURAL = [
  'removeExposureIds',
  'addExclusions',
  'removeExclusionIds',
  'addRestrictions',
  'removeRestrictionIds',
] as const satisfies readonly (keyof InterpretationPatch)[];

// Applies a correction and returns the next version, or the same record when nothing changed.
// Unknown ids and bad labels are reported together as VALIDATION_ERROR; text that talks to the
// model is OUT_OF_SCOPE, as in the conviction.
export function applyPatch(record: InterpretationRecord, patch: InterpretationPatch): InterpretationRecord {
  const structural = STRUCTURAL.filter((field) => (patch[field]?.length ?? 0) > 0);
  if (record.curated && structural.length) {
    throw new ApiError(422, 'INTERPRETATION_CURATED', "Suggested theses can't be edited. Describe your own version to change it.", {
      fields: structural,
    });
  }

  const invalid = new Set<string>();

  const ambiguities = record.ambiguities.map((a) => ({ ...a }));
  for (const { ambiguityId, optionId } of patch.answers ?? []) {
    const ambiguity = ambiguities.find((a) => a.id === ambiguityId);
    if (!ambiguity?.options.some((o) => o.id === optionId)) invalid.add('answers');
    else ambiguity.answer = optionId;
  }

  const remove = (list: LabeledItem[], ids: string[] | undefined, field: string) => {
    if (!ids?.length) return list;
    if (ids.some((id) => !list.some((item) => item.id === id))) invalid.add(field);
    return list.filter((item) => !ids.includes(item.id));
  };

  const add = (list: LabeledItem[], labels: string[] | undefined, prefix: string, field: string) => {
    const out = [...list];
    // Random ids, never a removed item's: a stale id on the front must not hit the new item.
    for (const raw of labels ?? []) {
      const label = normalizeText(raw);
      const refused = label ? screenConviction(label) : 'unclear';
      if (refused === 'unrelated') throw outOfScope('unrelated');
      if (refused) {
        invalid.add(field);
        continue;
      }
      if (out.some((item) => item.label.toLowerCase() === label.toLowerCase())) continue;
      out.push({ id: `${prefix}_${randomBytes(4).toString('hex')}`, label });
    }
    if (out.length > MAX_LABELS) invalid.add(field);
    return out;
  };

  // Removals first, so one PATCH can replace an item.
  const exposures = remove(record.exposures, patch.removeExposureIds, 'removeExposureIds');
  const exclusions = add(remove(record.exclusions, patch.removeExclusionIds, 'removeExclusionIds'), patch.addExclusions, 'exc', 'addExclusions');
  const restrictions = add(
    remove(record.restrictions, patch.removeRestrictionIds, 'removeRestrictionIds'),
    patch.addRestrictions,
    'res',
    'addRestrictions',
  );

  if (invalid.size) throw new ApiError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', { fields: [...invalid] });

  const next = { exposures, exclusions, restrictions, ambiguities };
  const before = { exposures: record.exposures, exclusions: record.exclusions, restrictions: record.restrictions, ambiguities: record.ambiguities };
  if (JSON.stringify(next) === JSON.stringify(before)) return record;
  return { ...record, ...next, status: statusOf(ambiguities), version: record.version + 1 };
}

// Answered questions as question and chosen option, the way the person saw them. Sent to the AI
// when composing and explaining.
export function answeredQuestions(r: Pick<InterpretationRecord, 'ambiguities'>): { question: string; answer: string }[] {
  return r.ambiguities.flatMap((a) => {
    const option = a.options.find((o) => o.id === a.answer);
    return option ? [{ question: a.question, answer: option.label }] : [];
  });
}
