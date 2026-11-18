import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/transport';
import { ADDRESS, renderAt } from '../purchase-shared/testing';
import { OperationScreen } from './OperationScreen';

const mocks = vi.hoisted(() => ({ getOperation: vi.fn(), prepareOperation: vi.fn() }));
vi.mock('../../api/client', () => ({ api: mocks }));

const base = {
  id: 'op_1', planId: 'plan_1', side: 'buy', status: 'confirmed', balanceUpdating: true, transaction: null,
  instrument: { id: 'ins_1', symbol: 'PWR-E', name: 'Power E', mint: 'm', decimals: 6, kind: 'token', status: 'approved', exposureLabel: 'x', issuerName: null },
  review: null,
  result: { signature: 's', explorerUrl: 'https://explorer.example/tx/s', inputAmount: '174.9', outputAmount: '12.5', failureReason: null },
  createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
};
const review = {
  inputAmount: '175.00', inputSymbol: 'USDC', estimatedOutput: '1', outputSymbol: 'PWR-E', minimumOutput: '1', slippageBps: 50,
  fees: [], destinationWallet: ADDRESS, expiresAt: '2026-10-01T00:01:00Z', planEffect: { targetBps: 1, currentBps: null, afterBps: null },
};
const render = () => renderAt(<OperationScreen />, '/operations/op_1', '/operations/:id');

describe('OperationScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows effective amounts, the balance note and the transaction link once confirmed', async () => {
    mocks.getOperation.mockResolvedValue(base);
    render();
    expect(await screen.findByText('Confirmed, updating balance.')).toBeInTheDocument();
    expect(screen.getByText('174.9 USDC')).toBeInTheDocument();
    expect(screen.getByText('12.5 PWR-E')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View transaction/ })).toHaveAttribute('href', 'https://explorer.example/tx/s');
  });

  it('keeps pending as not a failure and blocks retry', async () => {
    mocks.getOperation.mockResolvedValue({ ...base, status: 'pending', result: { ...base.result, explorerUrl: null, inputAmount: null, outputAmount: null } });
    render();
    expect(await screen.findByText(/not a failure/)).toBeInTheDocument();
    expect(screen.getByText('Wait until the previous attempt is settled')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /View transaction/ })).toBeNull();
  });

  it('retries a failed purchase only after looking the previous one up again', async () => {
    mocks.getOperation.mockResolvedValue({ ...base, status: 'failed', review });
    mocks.prepareOperation.mockResolvedValue({ ...base, id: 'op_2' });
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(mocks.prepareOperation).toHaveBeenCalledTimes(1));
    expect(mocks.getOperation).toHaveBeenCalledTimes(2);
    expect(mocks.prepareOperation.mock.calls[0]?.[0]).toMatchObject({ inputUsdc: '175.00', instrumentId: 'ins_1' });
    expect(typeof mocks.prepareOperation.mock.calls[0]?.[1]).toBe('string');
  });

  it('shows an error when the operation cannot be loaded', async () => {
    mocks.getOperation.mockRejectedValue(new ApiError({ status: 404, code: 'NOT_FOUND' }));
    render();
    expect(await screen.findByText(/could not find what you asked for/i)).toBeInTheDocument();
  });
});
