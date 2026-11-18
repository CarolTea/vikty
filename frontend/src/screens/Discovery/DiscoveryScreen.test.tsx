import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/transport';
import { WalletContext, type Wallet } from '../../wallet/wallet';

const api = vi.hoisted(() => ({
  getSession: vi.fn(),
  listSuggestedTheses: vi.fn(),
  createInterpretation: vi.fn(),
}));
vi.mock('../../api/client', () => ({ api }));

import { DiscoveryScreen } from './DiscoveryScreen';

const connect = vi.fn(async () => {});
const wallet: Wallet = {
  address: null, token: null, connect, disconnect: vi.fn(), signTransaction: vi.fn(),
};

function setup() {
  return render(
    <WalletContext.Provider value={wallet}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<DiscoveryScreen />} />
          <Route path="/interpretations/:id" element={<p>interpretation page</p>} />
        </Routes>
      </MemoryRouter>
    </WalletContext.Provider>,
  );
}

const session = (free: boolean) => ({
  anonymous: { freeInterpretationAvailable: free }, wallet: null, activePlanId: null, activeOperationIds: [], limits: { convictionMaxChars: 600 },
});

beforeEach(() => {
  vi.clearAllMocks();
  api.getSession.mockResolvedValue(session(true));
  api.listSuggestedTheses.mockResolvedValue({
    items: [{ id: 'th1', title: 'AI infrastructure', summary: 'Data centers and chips', text: 'AI will grow' }],
  });
});

describe('DiscoveryScreen', () => {
  it('shows the question, suggested theses and a disabled interpret button when empty', async () => {
    setup();
    expect(screen.getByRole('heading', { name: 'What do you believe in?' })).toBeInTheDocument();
    expect(await screen.findByText('AI infrastructure')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Interpret' })).toBeDisabled();
  });

  it('fills the text from a suggested thesis and interprets it', async () => {
    api.createInterpretation.mockResolvedValue({ id: 'int_1' });
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Use and edit' }));
    expect(screen.getByRole('textbox', { name: 'Your thesis' })).toHaveValue('AI will grow');
    await userEvent.click(screen.getByRole('button', { name: 'Interpret' }));
    expect(api.createInterpretation).toHaveBeenCalledWith({ source: 'free_text', text: 'AI will grow' }, { token: undefined });
    expect(await screen.findByText('interpretation page')).toBeInTheDocument();
  });

  it('keeps free text available when suggested theses fail to load', async () => {
    api.listSuggestedTheses.mockRejectedValue(new ApiError({ status: 503, code: 'UPSTREAM_UNAVAILABLE' }));
    setup();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Your thesis' }), 'My thesis');
    expect(screen.getByRole('button', { name: 'Interpret' })).toBeEnabled();
  });

  it('asks to connect the wallet when the free interpretation is used', async () => {
    api.getSession.mockResolvedValue(session(false));
    setup();
    const button = await screen.findByRole('button', { name: 'Connect wallet to interpret' });
    await userEvent.click(button);
    expect(connect).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Interpret' })).toBeNull();
  });

  it('shows the interpreting progress and keeps the draft on failure', async () => {
    let reject: (e: unknown) => void = () => {};
    api.createInterpretation.mockReturnValue(new Promise((_, r) => { reject = r; }));
    setup();
    await userEvent.type(screen.getByRole('textbox', { name: 'Your thesis' }), 'My thesis');
    await userEvent.click(screen.getByRole('button', { name: 'Interpret' }));
    expect(screen.getByText(/Reading your thesis/)).toBeInTheDocument();
    reject(new ApiError({ status: 503, code: 'AI_UNAVAILABLE' }));
    expect(await screen.findByText(/interpretation service is not available/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Your thesis' })).toHaveValue('My thesis');
  });
});
