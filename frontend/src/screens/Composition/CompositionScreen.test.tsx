import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ApiError } from '../../api/client';
import type { Transport } from '../../api/client';
import { WalletContext, type Wallet } from '../../wallet/wallet';
import { CompositionScreen } from './CompositionScreen';

const transport = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api/client')>();
  return { ...original, api: original.createApi(transport as unknown as Transport) };
});

const availability = { buy: 'available', sell: 'available', checkedAt: null };
const item = (id: string, symbol: string, weightBps: number, extra: Record<string, unknown> = {}) => ({
  instrument: { id, symbol, name: `${symbol} name`, mint: id, decimals: 6, kind: 'token', status: 'approved', exposureLabel: `${symbol} exposure`, issuerName: null },
  exposureIds: [],
  weightBps,
  plannedUsdc: String(weightBps / 20),
  rationale: `${symbol} rationale`,
  risks: [],
  availability,
  state: 'active',
  ...extra,
});
const valid = { valid: true, conclusive: true, totalBps: 10000, issues: [], policyVersion: 'p1' };
const proposal = (overrides: Record<string, unknown> = {}) => ({
  id: 'prop_1',
  interpretationId: 'int_1',
  curated: false,
  budgetUsdc: '500',
  items: [item('a', 'AAA', 6000), item('b', 'BBB', 4000)],
  validation: valid,
  limitations: [],
  ...overrides,
});

const connected: Wallet = { address: 'ADDR', token: 'tok', connect: vi.fn(), disconnect: vi.fn(), signTransaction: vi.fn() };
const disconnected: Wallet = { ...connected, address: null, token: null };

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
}

function setup(responses: Record<string, unknown>, wallet: Wallet = connected, at = '/proposals/prop_1') {
  transport.request.mockImplementation(async (method: string, path: string) => {
    const r = responses[`${method} ${path}`];
    if (r instanceof Error) throw r;
    if (r === undefined) throw new ApiError({ status: 404, code: 'NOT_FOUND' });
    return typeof r === 'function' ? (r as () => unknown)() : r;
  });
  return render(
    <WalletContext.Provider value={wallet}>
      <MemoryRouter initialEntries={[at]}>
        <Where />
        <Routes>
          <Route path="/proposals/:id" element={<CompositionScreen />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>
    </WalletContext.Provider>,
  );
}

const invest = (n = 0) => screen.getAllByRole('button', { name: 'Invest' })[n]!;

beforeEach(() => {
  transport.request.mockReset();
});

describe('CompositionScreen', () => {
  it('shows loading, then a valid plan with Invest enabled', async () => {
    setup({ 'GET /proposals/prop_1': proposal() });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(await screen.findByText('Valid plan: weights add up to 100%')).toBeInTheDocument();
    expect(invest(0)).toBeEnabled();
  });

  it('shows an error with retry when the proposal fails to load', async () => {
    setup({ 'GET /proposals/prop_1': new ApiError({ status: 404, code: 'NOT_FOUND' }) });
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('blocks Invest with the reason when validation failed', async () => {
    const bad = { ...valid, valid: false, issues: [{ code: 'SUM_NOT_100', severity: 'error', instrumentId: null, message: 'x', params: {} }] };
    setup({ 'GET /proposals/prop_1': proposal({ validation: bad }) });
    expect(await screen.findByText('Plan needs changes before you can invest')).toBeInTheDocument();
    expect(screen.getByText(/Weights must add up to 100%/)).toBeInTheDocument();
    expect(invest(0)).toBeDisabled();
    expect(screen.getAllByText('Fix the issues in the summary first.').length).toBeGreaterThan(0);
  });

  it('blocks Invest when validation is inconclusive', async () => {
    setup({ 'GET /proposals/prop_1': proposal({ validation: { ...valid, conclusive: false } }) });
    expect(await screen.findByText('Validation was inconclusive')).toBeInTheDocument();
    expect(invest(0)).toBeDisabled();
  });

  it('blocks only the asset that has no buy route', async () => {
    const noRoute = item('b', 'BBB', 4000, { availability: { ...availability, buy: 'no_route' } });
    setup({ 'GET /proposals/prop_1': proposal({ items: [item('a', 'AAA', 6000), noRoute] }) });
    await screen.findByText('Valid plan: weights add up to 100%');
    expect(invest(0)).toBeEnabled();
    expect(invest(1)).toBeDisabled();
    expect(screen.getByText('BBB has no buy route right now.')).toBeInTheDocument();
  });

  it('rejecting keeps the other weights and explains it, undo restores', async () => {
    const after = { validation: { ...valid, valid: false, totalBps: 6000, issues: [{ code: 'SUM_NOT_100', severity: 'error', instrumentId: null, message: 'x', params: {} }] }, items: [] };
    setup({ 'GET /proposals/prop_1': proposal(), 'POST /proposals/prop_1/validations': after });
    await screen.findByText('Valid plan: weights add up to 100%');
    fireEvent.click(screen.getAllByRole('button', { name: 'Reject' })[1]!);
    expect(screen.getByText('Weights are not redistributed')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('60')).toHaveLength(1);
    expect(await screen.findByText('Plan needs changes before you can invest')).toBeInTheDocument();
    const [, , init] = transport.request.mock.calls.find((c) => c[0] === 'POST') as [string, string, { body: { items: { weightBps: number; state: string }[] } }];
    expect(init.body.items).toEqual([expect.objectContaining({ weightBps: 6000, state: 'active' }), expect.objectContaining({ weightBps: 0, state: 'rejected' })]);
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    expect(await screen.findByText('Valid plan: weights add up to 100%')).toBeInTheDocument();
  });

  it('creates the plan from the draft and goes to activation', async () => {
    setup({ 'GET /proposals/prop_1': proposal(), 'POST /plans': { id: 'plan_9' } });
    await screen.findByText('Valid plan: weights add up to 100%');
    fireEvent.click(invest(0));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/plans/plan_9/activate'));
    const call = transport.request.mock.calls.find((c) => c[1] === '/plans') as [string, string, { body: { proposalId: string; budgetUsdc: string } }];
    expect(call[2].body).toMatchObject({ proposalId: 'prop_1', budgetUsdc: '500' });
  });

  it('asks the wallet to connect first when none is connected', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    setup({ 'GET /proposals/prop_1': proposal() }, { ...disconnected, connect });
    await screen.findByText('Valid plan: weights add up to 100%');
    fireEvent.click(invest(0));
    expect(connect).toHaveBeenCalled();
    expect(transport.request.mock.calls.some((c) => c[1] === '/plans')).toBe(false);
  });

  it('asks for a new proposal and opens it', async () => {
    setup({ 'GET /proposals/prop_1': proposal(), 'POST /proposals': { ...proposal(), id: 'prop_2' } });
    await screen.findByText('Valid plan: weights add up to 100%');
    fireEvent.click(screen.getByRole('button', { name: 'Ask for a new proposal' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/proposals/prop_2'));
  });
});

describe('InstrumentPanel', () => {
  const detail = (status = 'approved') => ({
    instrument: { ...item('a', 'AAA', 0).instrument, status },
    represents: 'A basket of things',
    issuer: { name: 'Issuer Co', nature: 'Tokenized note' },
    economicRights: ['Price exposure'],
    limitations: ['No voting'],
    risks: ['Market risk'],
    costs: ['0.1% fee'],
    howToTrade: 'Swap through a router',
    availability,
    evidence: [{ label: 'Issuer page', url: 'https://example.com/a', reviewedAt: '2026-09-01' }],
    eligibilityNotes: [],
  });

  it('opens from the search param with details, sources and review date', async () => {
    setup({ 'GET /proposals/prop_1': proposal(), 'GET /instruments/a': detail() }, connected, '/proposals/prop_1?instrument=a');
    expect(await screen.findByText('A basket of things')).toBeInTheDocument();
    expect(screen.getByText('Issuer Co')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Issuer page' })).toHaveAttribute('href', 'https://example.com/a');
    expect(screen.getByText(/reviewed Sep 1, 2026/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/proposals/prop_1');
    expect(screen.getByTestId('where')).not.toHaveTextContent('instrument=');
  });

  it('explains a restricted instrument', async () => {
    setup({ 'GET /proposals/prop_1': proposal(), 'GET /instruments/a': detail('restricted') }, connected, '/proposals/prop_1?instrument=a');
    expect(await screen.findByText(/This instrument is restricted/)).toBeInTheDocument();
  });

  it('shows an error without hiding the composition', async () => {
    setup({ 'GET /proposals/prop_1': proposal() }, connected, '/proposals/prop_1?instrument=a');
    expect(await screen.findAllByRole('button', { name: 'Try again' })).toHaveLength(1);
    expect(screen.getByText('Valid plan: weights add up to 100%')).toBeInTheDocument();
  });
});
