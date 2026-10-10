import { ApiError } from '../errors.js';
import type { AiInterpretation } from './interpreter.js';

// What goes into the AI and what comes out of it. Neither side is trusted: the conviction is
// written by anyone, and the answer may echo it, drift from the rules in the prompt or be steered by
// it. The scope gate in the adapter is the real filter; these checks are the cheap, deterministic
// layer around it.

export type OutOfScopeReason = 'unrelated' | 'unclear';

const OUT_OF_SCOPE_MESSAGES: Record<OutOfScopeReason, string> = {
  unrelated: 'We only work with beliefs about the economy. Describe a trend, sector or technology you think will grow.',
  unclear: "We couldn't find an economic belief in this text. Describe the trend you think will grow and why.",
};

export function outOfScope(reason: OutOfScopeReason): ApiError {
  return new ApiError(422, 'OUT_OF_SCOPE', OUT_OF_SCOPE_MESSAGES[reason], { reason });
}

// NFKC folds look-alike characters (fullwidth letters, ligatures) into plain ones; format
// characters (zero-width, bidi overrides) are dropped, since they can hide text from a human reader
// but not from the model; control characters and any run of whitespace become one space.
export function normalizeText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\p{Cf}/gu, '')
    .replace(/[\s\p{Cc}]+/gu, ' ')
    .trim();
}

// Obvious attempts to talk to the model instead of describing a belief, in English and Portuguese.
// Not exhaustive on purpose: anything subtler is the scope gate's job. Kept narrow so that a real
// thesis never trips it ("the financial system", "gold will act as a hedge" pass).
const INSTRUCTION_PATTERNS = [
  /\b(ignore|disregard|forget|override|bypass)\b.{0,40}\b(instructions?|rules|prompts?|guidelines)\b/i,
  /\b(ignor[ea]|esque[cç]a|desconsider[ea])\b.{0,40}\b(instru[cç](ões|oes|ão|ao)|regras|prompts?)\b/i,
  /\b(system|developer)\s+(prompt|message|instructions?)\b/i,
  /\b(reveal|show|print|repeat)\b.{0,30}\b(your|the)\s+(prompt|instructions)\b/i,
  /\byou are now\b|\bpretend (to be|you are)\b|\bfinja (ser|que)\b|\bvoc[eê] agora [eé]\b/i,
  /<\|?\/?(system|assistant|user|im_start|im_end)\|?>/i,
];

// Rejects, before any AI call or quota, text that can't be a conviction. Expects normalized text.
export function screenConviction(text: string): OutOfScopeReason | null {
  if (!/\p{L}/u.test(text)) return 'unclear';
  if (INSTRUCTION_PATTERNS.some((p) => p.test(text))) return 'unrelated';
  return null;
}

// Things the interpretation must never carry: the contract shows it on screen and stores it.
const FORBIDDEN_OUTPUT: { problem: string; pattern: RegExp }[] = [
  { problem: 'url', pattern: /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(com|io|xyz|finance|org|net|app)\b/i },
  { problem: 'email', pattern: /\b[^\s@]+@[^\s@]+\.[a-z]{2,}\b/i },
  // Solana addresses and mints are base58, 32 to 44 characters.
  { problem: 'address', pattern: /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/ },
  {
    problem: 'return_promise',
    pattern:
      /\b(guarantee[ds]?|risk[- ]free|can'?t lose|sure (bet|thing|win)|no[- ]brainer|to the moon|get rich)\b|\b\d+(\.\d+)?\s?%\s*(returns?|gains?|yield|upside|profit)\b/i,
  },
];

// A field this long that matches the conviction is a copy of it, and the conviction is never stored.
const ECHO_MIN_CHARS = 40;

export type InterpretationCheck = { ok: true; value: AiInterpretation } | { ok: false; problems: string[] };

// Cleans the answer (same normalization as the input, duplicates removed) and checks what the schema
// can't. `problems` holds codes only, never values: they may echo the person's text.
export function checkInterpretation(ai: AiInterpretation, conviction: string): InterpretationCheck {
  const problems = new Set<string>();
  const clean = (s: string) => {
    const out = normalizeText(s);
    if (!out) problems.add('empty_text');
    return out;
  };
  const labels = (list: string[]) => dedupe(list.map(clean));

  const value: AiInterpretation = {
    summary: clean(ai.summary),
    exposures: labels(ai.exposures),
    exclusions: labels(ai.exclusions),
    restrictions: labels(ai.restrictions),
    ambiguities: ai.ambiguities.map((a) => ({ question: clean(a.question), material: a.material, options: labels(a.options) })),
    representation: ai.representation,
    limitations: labels(ai.limitations),
  };

  if (value.ambiguities.some((a) => a.options.length < 2)) problems.add('ambiguity_options');
  if (value.representation !== 'insufficient' && value.exposures.length === 0) problems.add('representation_without_exposures');
  if (value.representation === 'insufficient' && value.limitations.length === 0) problems.add('insufficient_without_limitations');

  const source = normalizeText(conviction).toLowerCase();
  for (const text of allTexts(value)) {
    for (const { problem, pattern } of FORBIDDEN_OUTPUT) if (pattern.test(text)) problems.add(problem);
    const lower = text.toLowerCase();
    if (
      (source.length >= ECHO_MIN_CHARS && lower.includes(source)) ||
      (lower.length >= ECHO_MIN_CHARS && source.includes(lower))
    ) {
      problems.add('echo');
    }
  }

  return problems.size ? { ok: false, problems: [...problems] } : { ok: true, value };
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter((s) => {
    const key = s.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function allTexts(ai: AiInterpretation): string[] {
  return [
    ai.summary,
    ...ai.exposures,
    ...ai.exclusions,
    ...ai.restrictions,
    ...ai.ambiguities.flatMap((a) => [a.question, ...a.options]),
    ...ai.limitations,
  ];
}
