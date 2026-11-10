import type { Availability } from './composition.js';

// Whether an instrument can be bought or sold right now (PRD §10.2): momentary, from Jupiter, and
// separate from approval. A failed or missing check is `unknown`, never a guess.
export interface AvailabilityLookup {
  check(instrumentIds: string[]): Promise<Map<string, Availability>>;
}

const UNKNOWN: Availability = { buy: 'unknown', sell: 'unknown', checkedAt: null };

// Until the Jupiter adapter exists every instrument is `unknown`, so validations are inconclusive
// and the invest button stays blocked.
export const noAvailabilityYet: AvailabilityLookup = {
  async check(instrumentIds) {
    return new Map(instrumentIds.map((id) => [id, UNKNOWN]));
  },
};
