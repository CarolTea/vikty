import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADDRESS, renderAt } from '../purchase-shared/testing';
import { PurchaseReviewScreen } from './PurchaseReviewScreen';

const mocks = vi.hoisted(() => ({
  getOperation: vi.fn(), getPlan: vi.fn(), createQuote: vi.fn(), recordSignatureEvent: vi.fn(), createSubmission: vi.fn(),
}));
vi.mock('../../api/client', () => ({ api: mocks }));

const review = () => ({
  inputAmount: '175.00', inputSymbol: 'USDC', estimatedOutput: '12.5', outputSymbol: 'PWR-E', minimumOutput: '12.4',
  slippageBps: 50, fees: [], destinationWallet: ADDRESS, expiresAt: new Date(Date.now() + 60_000).toISOString(),
  planEffect: { targetBps: 3500, currentBps: null, afterBps: 3000 },
});
const op = (over: object = {}) => ({
  id: 'op_1', planId: 'plan_1', side: 'buy', status: 'ready_for_review', balanceUpdating: false, transaction: 'dHg=', review: review(),
  instrument: { id: 'i', symbol: 'PWR-E', name: 'Power E', mint: 'm', decimals: 6, kind: 'token', status: 'approved', exposureLabel: 'x', issuerName: null },
  result: { signature: null, explorerUrl: null, inputAmount: null, outputAmount: null, failureReason: null },
  createdAt: '', updatedAt: '', ...over,
});
const render = (wallet = {}) => renderAt(<PurchaseReviewScreen />, '/operations/op_1/review', '/operations/:id/review', wallet);

describe('PurchaseReviewScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlan.mockResolvedValue({ validation: { valid: true, conclusive: true } });
  });

  it('signs and submits once even on a double click, then goes to the operation', async () => {
    mocks.getOperation.mockResolvedValue(op());
    mocks.recordSignatureEvent.mockResolvedValue(op({ status: 'awaiting_signature' }));
    mocks.createSubmission.mockResolvedValue(op({ status: 'sending' }));
    render();
    await userEvent.dblClick(await screen.findByRole('button', { name: 'Authorize in wallet' }));
    expect(await screen.findByTestId('elsewhere')).toHaveTextContent('/operations/op_1');
    expect(mocks.createSubmission).toHaveBeenCalledTimes(1);
    expect(mocks.createSubmission.mock.calls[0]?.[1]).toEqual({ signedTransaction: 'signed:dHg=' });
  });

  it('asks for no signature when the quote has no transaction', async () => {
    mocks.getOperation.mockResolvedValue(op({ transaction: null }));
    render();
    expect(await screen.findByText('No transaction for this quote')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Authorize in wallet' })).toBeDisabled();
    expect(mocks.recordSignatureEvent).not.toHaveBeenCalled();
  });

  it('records a refused signature and submits nothing', async () => {
    mocks.getOperation.mockResolvedValue(op());
    mocks.recordSignatureEvent.mockResolvedValueOnce(op()).mockResolvedValueOnce(op({ status: 'rejected', transaction: null }));
    render({ signTransaction: async () => { throw new Error('refused'); } });
    await userEvent.click(await screen.findByRole('button', { name: 'Authorize in wallet' }));
    expect(await screen.findByText('Signature declined')).toBeInTheDocument();
    expect(mocks.createSubmission).not.toHaveBeenCalled();
    expect(mocks.recordSignatureEvent).toHaveBeenLastCalledWith('op_1', { type: 'signature_rejected' }, { token: 'token' });
  });

  it('blocks authorization when the wallet changed', async () => {
    mocks.getOperation.mockResolvedValue(op());
    render({ address: 'OtherWallet1111111111111111111111111111111111' });
    expect(await screen.findByText('Wallet changed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Authorize in wallet' })).toBeDisabled();
  });

  it('blocks purchases when availability is inconclusive', async () => {
    mocks.getOperation.mockResolvedValue(op());
    mocks.getPlan.mockResolvedValue({ validation: { valid: true, conclusive: false } });
    render();
    expect(await screen.findByText(/confirm this asset is available/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Authorize in wallet' })).toBeDisabled());
  });

  it('offers a new quote when the previous one expired', async () => {
    mocks.getOperation.mockResolvedValue(op({ status: 'expired' }));
    mocks.createQuote.mockResolvedValue(op());
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Refresh quote' }));
    expect(await screen.findByRole('button', { name: 'Authorize in wallet' })).toBeEnabled();
  });
});
