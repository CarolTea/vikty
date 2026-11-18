// The only place that knows URLs. Screens navigate with these helpers, never with string literals.
export const routes = {
  landing: () => '/',
  discovery: () => '/start',
  interpretation: (id: string) => `/interpretations/${encodeURIComponent(id)}`,
  composition: (proposalId: string) => `/proposals/${encodeURIComponent(proposalId)}`,
  /** Instrument details open as a side panel over the composition. */
  instrument: (proposalId: string, instrumentId: string) =>
    `/proposals/${encodeURIComponent(proposalId)}?instrument=${encodeURIComponent(instrumentId)}`,
  activatePlan: (planId: string) => `/plans/${encodeURIComponent(planId)}/activate`,
  purchaseReview: (operationId: string) => `/operations/${encodeURIComponent(operationId)}/review`,
  operation: (operationId: string) => `/operations/${encodeURIComponent(operationId)}`,
  showcase: () => '/showcase',
} as const;
