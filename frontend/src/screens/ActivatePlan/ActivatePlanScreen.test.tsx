import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/transport';
import { ADDRESS, renderAt } from '../purchase-shared/testing';
import { ActivatePlanScreen } from './ActivatePlanScreen';

const mocks = vi.hoisted(() => ({ getPlan: vi.fn(), getWalletBalances: vi.fn(), activatePlan: vi.fn(), prepareOperation: vi.fn() }));
vi.mock('../../api/client', () => ({ api: mocks }));

const instrument = { id: 'ins_1', symbol: 'PWR-E', name: 'Power E', mint: 'mint1', decimals: 6, kind: 'token', status: 'approved', exposureLabel: 'x', issuerName: null };
const plan = (over: object = {}) => ({
  id: 'plan_1', status: 'draft', budgetUsdc: '500', trackedMints: [], items: [{ instrument, state: 'active', plannedUsdc: '175.00', weightBps: 3500 }], ...over,
});
const balances = (usdc: string | null, held = '0') => ({
  wallet: ADDRESS, network: 'solana', fetchedAt: '', sol: { quantity: '1', suggestedFeeReserve: '0.05' },
  tokens: [
    ...(usdc === null ? [] : [{ mint: 'usdc', instrumentId: null, symbol: 'USDC', quantity: usdc, decimals: 6, inCatalog: true }]),
    { mint: 'mint1', instrumentId: 'ins_1', symbol: 'PWR-E', quantity: held, decimals: 6, inCatalog: true },
  ],
});
const render = () => renderAt(<ActivatePlanScreen />, '/plans/plan_1/activate', '/plans/:id/activate');

describe('ActivatePlanScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('says so when the wallet holds no USDC', async () => {
    mocks.getPlan.mockResolvedValue(plan());
    mocks.getWalletBalances.mockResolvedValue(balances(null));
    render();
    expect(await screen.findByText('No USDC in this wallet')).toBeInTheDocument();
  });

  it('keeps the plan and limits the purchase when the budget exceeds the balance', async () => {
    mocks.getPlan.mockResolvedValue(plan({ status: 'active', trackedMints: ['mint1'] }));
    mocks.getWalletBalances.mockResolvedValue(balances('100'));
    mocks.prepareOperation.mockResolvedValue({ id: 'op_9' });
    render();
    expect(await screen.findByText('Budget is above your balance')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Review purchase of 100 USDC' }));
    await waitFor(() => expect(mocks.prepareOperation).toHaveBeenCalledTimes(1));
    expect(mocks.prepareOperation.mock.calls[0]?.[0]).toMatchObject({ side: 'buy', inputUsdc: '100' });
    expect(await screen.findByTestId('elsewhere')).toHaveTextContent('/operations/op_9/review');
  });

  it('requires confirming existing balances and shows no invented cost', async () => {
    mocks.getPlan.mockResolvedValue(plan());
    mocks.getWalletBalances.mockResolvedValue(balances('500', '3'));
    mocks.activatePlan.mockResolvedValue(plan({ status: 'active', trackedMints: ['mint1'] }));
    render();
    expect(await screen.findByText(/Cost basis not known/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activate plan' })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: /existing balances are tracked/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Activate plan' }));
    expect(await screen.findByText('Plan active')).toBeInTheDocument();
    expect(mocks.activatePlan.mock.calls[0]?.[1]).toEqual({ status: 'active', trackedMints: ['mint1'], confirmPreexistingBalances: true });
  });

  it('shows an error when balances cannot be read', async () => {
    mocks.getPlan.mockResolvedValue(plan());
    mocks.getWalletBalances.mockRejectedValue(new ApiError({ status: 503, code: 'UPSTREAM_UNAVAILABLE' }));
    render();
    expect(await screen.findByText(/service we depend on/)).toBeInTheDocument();
  });
});
