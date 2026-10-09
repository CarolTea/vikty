import { findInstrument, type Instrument } from './catalog/instruments.js';
import type { Config } from './config.js';
import { BPS_TOTAL, formatPercent, formatUsdc, parseUsdc, shareOf } from './money.js';

// The deterministic validator (PRD §9.4): the same checks after the AI proposes, after every edit
// and before an operation. It never fixes anything: rejecting an asset or breaking a limit is
// reported, and the person adjusts (PRD §7.3: no silent redistribution).

export type ItemState = 'active' | 'rejected';

export interface DraftItem {
  instrumentId: string;
  weightBps: number;
  state: ItemState;
}

export type AvailabilityState = 'available' | 'no_route' | 'suspended' | 'restricted';

export interface Availability {
  buy: AvailabilityState;
  sell: AvailabilityState;
  checkedAt: string;
}

export type IssueCode =
  | 'SUM_NOT_100'
  | 'WEIGHT_ABOVE_MAX'
  | 'WEIGHT_BELOW_MIN'
  | 'EXCLUSION_VIOLATED'
  | 'INSTRUMENT_NOT_APPROVED'
  | 'INCOMPATIBLE_SUBSTITUTION'
  | 'BUDGET_INVALID'
  | 'PARTIAL_REPRESENTATION'
  | 'NO_ROUTE';

// The contract's ValidationIssue and Validation.
export interface ValidationIssue {
  code: IssueCode;
  severity: 'error' | 'warning';
  instrumentId: string | null;
  message: string;
  params: Record<string, string | number>;
}

export interface Validation {
  valid: boolean;
  conclusive: boolean;
  totalBps: number;
  issues: ValidationIssue[];
  policyVersion: string;
}

// Limits come from configuration (contract, "Em aberto" 5); the version names the values in force,
// so a stored validation says which rules it passed.
export interface Policy {
  maxWeightBps: number;
  minWeightBps: number;
  minBudgetUsdc: string;
  maxBudgetUsdc: string;
}

export function policyFromConfig(config: Config): Policy {
  return {
    maxWeightBps: config.MAX_WEIGHT_BPS,
    minWeightBps: config.MIN_WEIGHT_BPS,
    minBudgetUsdc: config.MIN_BUDGET_USDC,
    maxBudgetUsdc: config.MAX_BUDGET_USDC,
  };
}

export function policyVersion(p: Policy): string {
  return `v1;weight=${p.minWeightBps}-${p.maxWeightBps};budget=${p.minBudgetUsdc}-${p.maxBudgetUsdc}`;
}

export interface ValidationContext {
  policy: Policy;
  // What the proposal offered: only these instruments may appear in the draft, each standing for
  // the exposures listed.
  proposalItems: readonly { instrumentId: string; exposureIds: readonly string[] }[];
  // The interpretation's exposures, to warn when none of the active assets represents one any more.
  exposures: readonly { id: string; label: string }[];
  // Instruments the interpretation's exclusions rule out, resolved when the proposal was made.
  excludedInstrumentIds: readonly string[];
  // Buy availability by instrument id, from Jupiter. Missing for an active asset → inconclusive.
  availability: ReadonlyMap<string, Availability>;
  // The registry by default; tests pass their own.
  lookup?: (id: string) => Instrument | undefined;
}

export interface ValidationResult {
  validation: Validation;
  // Planned amount per instrument id: budget × weight for active items, 0 for rejected ones.
  plannedUsdc: Map<string, string>;
}

export function duplicateInstrumentIds(items: readonly DraftItem[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const { instrumentId } of items) {
    if (seen.has(instrumentId)) duplicates.add(instrumentId);
    seen.add(instrumentId);
  }
  return [...duplicates];
}

export function validateDraft(budgetUsdc: string, items: readonly DraftItem[], ctx: ValidationContext): ValidationResult {
  if (duplicateInstrumentIds(items).length) throw new Error('duplicate instrument ids: reject them as a 400 first');

  const { policy } = ctx;
  const issues: ValidationIssue[] = [];
  const error = (code: IssueCode, instrumentId: string | null, message: string, params: ValidationIssue['params'] = {}) =>
    issues.push({ code, severity: 'error', instrumentId, message, params });
  const warning = (code: IssueCode, instrumentId: string | null, message: string, params: ValidationIssue['params'] = {}) =>
    issues.push({ code, severity: 'warning', instrumentId, message, params });

  const budget = parseUsdc(budgetUsdc);
  const minBudget = parseUsdc(policy.minBudgetUsdc)!;
  const maxBudget = parseUsdc(policy.maxBudgetUsdc)!;
  const budgetOk = budget !== null && budget >= minBudget && budget <= maxBudget && budget > 0n;
  if (!budgetOk) {
    error('BUDGET_INVALID', null, `Enter a budget between ${policy.minBudgetUsdc} and ${policy.maxBudgetUsdc} USDC.`, {
      min: policy.minBudgetUsdc,
      max: policy.maxBudgetUsdc,
    });
  }

  const lookup = ctx.lookup ?? findInstrument;
  const offered = new Map(ctx.proposalItems.map((p) => [p.instrumentId, p.exposureIds]));
  const excluded = new Set(ctx.excludedInstrumentIds);
  const active = items.filter((i) => i.state === 'active');
  let conclusive = true;

  for (const item of items) {
    const id = item.instrumentId;
    const instrument = lookup(id);
    const name = symbolOf(instrument);

    if (!offered.has(id)) {
      error('INCOMPATIBLE_SUBSTITUTION', id, `${name} wasn't part of this proposal. Only its original assets can be used.`);
      continue;
    }
    if (item.state === 'rejected') continue;

    if (!instrument || instrument.status !== 'approved') {
      error('INSTRUMENT_NOT_APPROVED', id, `${name} isn't approved for investing.`, {
        status: instrument?.status ?? 'unknown',
      });
    }
    if (excluded.has(id)) {
      error('EXCLUSION_VIOLATED', id, `${name} goes against an exclusion in your thesis.`);
    }
    if (item.weightBps > policy.maxWeightBps) {
      error('WEIGHT_ABOVE_MAX', id, `${name} is at ${formatPercent(item.weightBps)}. The limit per asset is ${formatPercent(policy.maxWeightBps)}.`, {
        weightBps: item.weightBps,
        maxBps: policy.maxWeightBps,
      });
    }
    if (item.weightBps < policy.minWeightBps) {
      error(
        'WEIGHT_BELOW_MIN',
        id,
        `${name} is at ${formatPercent(item.weightBps)}. The minimum per asset is ${formatPercent(policy.minWeightBps)}: raise it or reject the asset.`,
        { weightBps: item.weightBps, minBps: policy.minWeightBps },
      );
    }

    const availability = ctx.availability.get(id);
    if (!availability) conclusive = false;
    else if (availability.buy !== 'available') {
      warning('NO_ROUTE', id, `No buy route for ${name} right now.`, { buy: availability.buy });
    }
  }

  const totalBps = active.reduce((sum, i) => sum + i.weightBps, 0);
  if (totalBps !== BPS_TOTAL) {
    error('SUM_NOT_100', null, `Weights add up to ${formatPercent(totalBps)}. Adjust them to reach 100%.`, { totalBps });
  }

  const represented = new Set(active.flatMap((i) => offered.get(i.instrumentId) ?? []));
  for (const exposure of ctx.exposures) {
    if (!represented.has(exposure.id)) {
      warning('PARTIAL_REPRESENTATION', null, `No active asset represents ${exposure.label} any more.`, {
        exposureId: exposure.id,
      });
    }
  }

  const plannedUsdc = new Map(
    items.map((i) => [
      i.instrumentId,
      formatUsdc(budgetOk && i.state === 'active' ? shareOf(budget!, i.weightBps) : 0n),
    ]),
  );

  return {
    validation: {
      valid: !issues.some((i) => i.severity === 'error'),
      conclusive,
      totalBps,
      issues,
      policyVersion: policyVersion(policy),
    },
    plannedUsdc,
  };
}

function symbolOf(instrument: Instrument | undefined): string {
  return instrument?.symbol ?? 'This asset';
}
