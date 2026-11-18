import { createHttpTransport } from './http';
import { createMockTransport } from './mock/transport';
import type { operations } from './schema';
import type { Transport } from './transport';

export { ApiError } from './transport';
export type { ApiErrorCode, ContractErrorCode, Transport } from './transport';

// Types come from the generated contract; nothing is declared by hand.
type OperationId = keyof operations;
type Success<K extends OperationId> = operations[K]['responses'] extends infer R
  ? R[Extract<keyof R, 200 | 201 | 202 | 204>] extends { content: { 'application/json': infer B } }
    ? B
    : void
  : never;
type Payload<K extends OperationId> = operations[K]['requestBody'] extends {
  content: { 'application/json': infer B };
}
  ? B
  : never;

/** Per-call options shared by every route. */
export interface CallOptions {
  /** Privy access token; required by wallet routes, optional elsewhere. */
  token?: string;
  /** Mock transport only: name of a named example from the contract to serve. */
  mockExample?: string;
}

export function selectTransport(mode: string | undefined = import.meta.env.VITE_API_MODE): Transport {
  const useMock = mode ? mode === 'mock' : import.meta.env.DEV;
  return useMock ? createMockTransport() : createHttpTransport();
}

export function createApi(transport: Transport) {
  const seg = encodeURIComponent;
  return {
    getSession: (o?: CallOptions) => transport.request<Success<'getSession'>>('GET', '/session', o),
    listSuggestedTheses: (o?: CallOptions) =>
      transport.request<Success<'listSuggestedTheses'>>('GET', '/theses/suggested', o),

    createInterpretation: (body: Payload<'createInterpretation'>, o?: CallOptions) =>
      transport.request<Success<'createInterpretation'>>('POST', '/interpretations', { ...o, body }),
    getInterpretation: (id: string, o?: CallOptions) =>
      transport.request<Success<'getInterpretation'>>('GET', `/interpretations/${seg(id)}`, o),
    updateInterpretation: (id: string, body: Payload<'updateInterpretation'>, o?: CallOptions) =>
      transport.request<Success<'updateInterpretation'>>('PATCH', `/interpretations/${seg(id)}`, { ...o, body }),

    createProposal: (body: Payload<'createProposal'>, o?: CallOptions) =>
      transport.request<Success<'createProposal'>>('POST', '/proposals', { ...o, body }),
    getProposal: (id: string, o?: CallOptions) =>
      transport.request<Success<'getProposal'>>('GET', `/proposals/${seg(id)}`, o),
    createProposalValidation: (id: string, body: Payload<'createProposalValidation'>, o?: CallOptions) =>
      transport.request<Success<'createProposalValidation'>>('POST', `/proposals/${seg(id)}/validations`, {
        ...o,
        body,
      }),
    createExplanation: (id: string, body: Payload<'createExplanation'>, o?: CallOptions) =>
      transport.request<Success<'createExplanation'>>('POST', `/proposals/${seg(id)}/explanations`, {
        ...o,
        body,
      }),

    getInstrument: (id: string, o?: CallOptions) =>
      transport.request<Success<'getInstrument'>>('GET', `/instruments/${seg(id)}`, o),

    listPlans: (o?: CallOptions) => transport.request<Success<'listPlans'>>('GET', '/plans', o),
    getPlan: (id: string, o?: CallOptions) => transport.request<Success<'getPlan'>>('GET', `/plans/${seg(id)}`, o),
    createPlan: (body: Payload<'createPlan'>, o?: CallOptions) =>
      transport.request<Success<'createPlan'>>('POST', '/plans', { ...o, body }),
    updatePlan: (id: string, body: Payload<'updatePlan'>, o?: CallOptions) =>
      transport.request<Success<'updatePlan'>>('PUT', `/plans/${seg(id)}`, { ...o, body }),
    activatePlan: (id: string, body: Payload<'activatePlan'>, o?: CallOptions) =>
      transport.request<Success<'activatePlan'>>('PATCH', `/plans/${seg(id)}`, { ...o, body }),

    getWalletBalances: (o?: CallOptions) =>
      transport.request<Success<'getWalletBalances'>>('GET', '/wallet/balances', o),

    prepareOperation: (body: Payload<'prepareOperation'>, idempotencyKey: string, o?: CallOptions) =>
      transport.request<Success<'prepareOperation'>>('POST', '/operations', { ...o, body, idempotencyKey }),
    listActiveOperations: (o?: CallOptions) =>
      transport.request<Success<'listActiveOperations'>>('GET', '/operations', { ...o, query: { active: true } }),
    createQuote: (id: string, o?: CallOptions) =>
      transport.request<Success<'createQuote'>>('POST', `/operations/${seg(id)}/quotes`, o),
    recordSignatureEvent: (id: string, body: Payload<'recordSignatureEvent'>, o?: CallOptions) =>
      transport.request<Success<'recordSignatureEvent'>>('POST', `/operations/${seg(id)}/events`, { ...o, body }),
    createSubmission: (id: string, body: Payload<'createSubmission'>, idempotencyKey: string, o?: CallOptions) =>
      transport.request<Success<'createSubmission'>>('POST', `/operations/${seg(id)}/submissions`, {
        ...o,
        body,
        idempotencyKey,
      }),
    getOperation: (id: string, o?: CallOptions) =>
      transport.request<Success<'getOperation'>>('GET', `/operations/${seg(id)}`, o),

    getPosition: (id: string, o?: CallOptions) =>
      transport.request<Success<'getPosition'>>('GET', `/plans/${seg(id)}/position`, o),
    createReconciliation: (id: string, o?: CallOptions) =>
      transport.request<Success<'createReconciliation'>>('POST', `/plans/${seg(id)}/reconciliations`, o),
    listActivity: (query?: { cursor?: string; limit?: number }, o?: CallOptions) =>
      transport.request<Success<'listActivity'>>('GET', '/activity', { ...o, query }),

    trackEvents: (body: Payload<'trackEvents'>, o?: CallOptions) =>
      transport.request<Success<'trackEvents'>>('POST', '/events', { ...o, body }),
  };
}

export type Api = ReturnType<typeof createApi>;

/** The app-wide client; screens import this and never call fetch. */
export const api: Api = createApi(selectTransport());
