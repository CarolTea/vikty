import { registry } from './registry.js';

// The Asset Registry (PRD §10): the only source of instruments a proposal, plan or operation may use.
// The AI picks among these ids; it never introduces a mint (PRD §9.2). Approval is a product decision
// backed by evidence, separate from availability, which is momentary and comes from Jupiter.

export type InstrumentStatus = 'approved' | 'restricted' | 'unavailable';
export type InstrumentKind = 'token' | 'cash';
export type InstrumentType =
  | 'tokenized_equity'
  | 'tokenized_etf'
  | 'tokenized_commodity'
  | 'tokenized_fixed_income'
  | 'digital_asset'
  | 'stablecoin';
export type Region = 'us' | 'brazil' | 'latam' | 'global';

export interface Evidence {
  label: string;
  url: string;
  // ISO date (YYYY-MM-DD) of the human review that confirmed it.
  reviewedAt: string;
}

// What the instrument detail screen explains (contract InstrumentDetail). Written by whoever reviews
// the instrument; required before it is approved.
export interface InstrumentDetailContent {
  issuerNature: string;
  economicRights: readonly string[];
  limitations: readonly string[];
  costs: readonly string[];
  howToTrade: string;
  eligibilityNotes: readonly string[];
}

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  // Null until confirmed on-chain (spike S1). An instrument without a mint is never approved.
  mint: string | null;
  decimals: number | null;
  kind: InstrumentKind;
  status: InstrumentStatus;
  instrumentType: InstrumentType;
  exposureLabel: string;
  issuerName: string | null;
  underlying: string | null;
  // What the instrument is, in plain words; shown as "represents" in the instrument detail.
  represents: string;
  // Matching metadata for proposals: the economic exposure behind the instrument, not who may buy it.
  region: Region;
  countryExposure: readonly string[];
  currencyExposure: readonly string[];
  themes: readonly string[];
  exposures: readonly string[];
  riskTags: readonly string[];
  // Where the curation started; not evidence until someone reviews it.
  sourceUrl: string;
  evidence: readonly Evidence[];
  detail?: InstrumentDetailContent;
}

// The contract's InstrumentSummary. Only call it for an approved instrument (mint and decimals set).
export interface InstrumentSummary {
  id: string;
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  kind: InstrumentKind;
  status: InstrumentStatus;
  exposureLabel: string;
  issuerName: string | null;
}

const byId = new Map(registry.map((i) => [i.id, i]));

export function findInstrument(id: string): Instrument | undefined {
  return byId.get(id);
}

export function approvedInstruments(): Instrument[] {
  return registry.filter((i) => i.status === 'approved');
}

export function instrumentSummary(i: Instrument): InstrumentSummary {
  if (i.mint === null || i.decimals === null) throw new Error(`instrument ${i.id} has no confirmed mint`);
  return {
    id: i.id,
    symbol: i.symbol,
    name: i.name,
    mint: i.mint,
    decimals: i.decimals,
    kind: i.kind,
    status: i.status,
    exposureLabel: i.exposureLabel,
    issuerName: i.issuerName,
  };
}

// What routes use to reach the registry. Tests pass their own approved instruments.
export interface Catalog {
  approved(): Instrument[];
  find(id: string): Instrument | undefined;
}

export const registryCatalog: Catalog = { approved: approvedInstruments, find: findInstrument };

// Registry risk tags as text for the screen: 'market-risk' → 'Market risk'.
export function riskLabels(i: Instrument): string[] {
  return i.riskTags.map((tag) => {
    const text = tag.replaceAll('-', ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
  });
}
