import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { AppHeader } from './AppHeader';

describe('AppHeader', () => {
  it('renders brand, network and connect button', async () => {
    const onConnect = vi.fn();
    render(<AppHeader onConnect={onConnect} />);
    expect(screen.getByText('VicTy')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Network: Solana' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Connect wallet' }));
    expect(onConnect).toHaveBeenCalledOnce();
  });

  it('shows the address instead of the connect button', () => {
    render(<AppHeader address="7xKp…9fQ2" />);
    expect(screen.getByText('7xKp…9fQ2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect wallet' })).toBeNull();
  });
});
