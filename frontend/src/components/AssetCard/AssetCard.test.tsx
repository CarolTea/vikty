import { fireEvent, render, screen } from '@testing-library/react';
import { AssetCard } from './AssetCard';

const base = { ticker: 'SOL', name: 'Solana', exposure: 'Network token', weightBps: 3500, amount: '175' };

describe('AssetCard', () => {
  it('shows weight and amount with the unit after the number', () => {
    render(<AssetCard {...base} />);
    expect(screen.getByText('35%')).toBeInTheDocument();
    expect(screen.getByText('175 USDC')).toBeInTheDocument();
  });

  it('shows a placeholder when the amount is missing', () => {
    render(<AssetCard {...base} amount={null} />);
    expect(screen.getByText('Price unavailable')).toBeInTheDocument();
  });

  it('rejected card shows Undo and no weight or redistribution text', () => {
    const onUndo = vi.fn();
    render(<AssetCard {...base} state="rejected" onUndo={onUndo} />);
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    expect(onUndo).toHaveBeenCalled();
    expect(screen.queryByText('35%')).toBeNull();
    expect(screen.queryByText(/redistribut/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Invest' })).toBeNull();
  });

  it('disabled Invest shows its reason', () => {
    render(<AssetCard {...base} investDisabledReason="Fix weights to invest" />);
    expect(screen.getByRole('button', { name: 'Invest' })).toBeDisabled();
    expect(screen.getByText('Fix weights to invest')).toBeInTheDocument();
  });

  it('cash kind has no Reject or Invest', () => {
    render(<AssetCard {...base} kind="cash" />);
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Invest' })).toBeNull();
  });

  it('flags missing routes and fires actions', () => {
    const onReject = vi.fn();
    const onInvest = vi.fn();
    render(<AssetCard {...base} availability={{ buy: 'no_route', sell: 'no_route' }} onReject={onReject} onInvest={onInvest} />);
    expect(screen.getByText('Approved · no buy route right now')).toBeInTheDocument();
    expect(screen.getByText('No sell route')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    fireEvent.click(screen.getByRole('button', { name: 'Invest' }));
    expect(onReject).toHaveBeenCalled();
    expect(onInvest).toHaveBeenCalled();
  });
});
