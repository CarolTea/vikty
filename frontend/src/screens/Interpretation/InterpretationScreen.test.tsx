import { routes } from '../routes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/transport';
import { WalletContext, type Wallet } from '../../wallet/wallet';

const api = vi.hoisted(() => ({
  getInterpretation: vi.fn(),
  updateInterpretation: vi.fn(),
  createProposal: vi.fn(),
}));
vi.mock('../../api/client', () => ({ api }));

import { InterpretationScreen } from './InterpretationScreen';

const wallet: Wallet = {
  address: null, token: null, connect: vi.fn(async () => {}), disconnect: vi.fn(), signTransaction: vi.fn(),
};

function setup() {
  return render(
    <WalletContext.Provider value={wallet}>
      <MemoryRouter initialEntries={['/interpretations/int_1']}>
        <Routes>
          <Route path={routes.discovery()} element={<p>discovery page</p>} />
          <Route path="/interpretations/:id" element={<InterpretationScreen />} />
          <Route path="/proposals/:id" element={<p>composition page</p>} />
        </Routes>
      </MemoryRouter>
    </WalletContext.Provider>,
  );
}

const base = {
  id: 'int_1', source: 'free_text', curated: false, summary: 'AI will reshape data centers',
  exposures: [{ id: 'e1', label: 'AI infrastructure' }],
  exclusions: [{ id: 'x1', label: 'Single-company bets' }],
  restrictions: [],
  ambiguities: [],
  representation: 'sufficient', limitations: [], status: 'ready',
};
const question = {
  id: 'a1', question: 'Which region matters most?', material: true, answer: null,
  options: [{ id: 'o1', label: 'Global' }, { id: 'o2', label: 'United States' }],
};

beforeEach(() => vi.clearAllMocks());

describe('InterpretationScreen', () => {
  it('shows the interpretation blocks and confirms into the composition', async () => {
    api.getInterpretation.mockResolvedValue({ ...base, curated: true });
    api.createProposal.mockResolvedValue({ id: 'prop_1' });
    setup();
    expect(await screen.findByText('AI will reshape data centers')).toBeInTheDocument();
    expect(screen.getByText('AI infrastructure')).toBeInTheDocument();
    expect(screen.getByText('Single-company bets')).toBeInTheDocument();
    expect(screen.getByText('Curated thesis')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm and see composition' }));
    expect(api.createProposal).toHaveBeenCalledWith({ interpretationId: 'int_1', budgetUsdc: '100.00' }, { token: undefined });
    expect(await screen.findByText('composition page')).toBeInTheDocument();
  });

  it('blocks confirmation until the material question is answered', async () => {
    api.getInterpretation.mockResolvedValue({ ...base, status: 'needs_clarification', ambiguities: [question] });
    api.updateInterpretation.mockResolvedValue({ ...base, ambiguities: [{ ...question, answer: 'o1' }] });
    setup();
    expect(await screen.findByText('Which region matters most?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm and see composition' })).toBeDisabled();
    expect(screen.getByText('Answer the open question to continue')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Global' }));
    expect(api.updateInterpretation).toHaveBeenCalledWith('int_1', { answers: [{ ambiguityId: 'a1', optionId: 'o1' }] }, { token: undefined });
    expect(await screen.findByRole('button', { name: 'Confirm and see composition' })).toBeEnabled();
  });

  it('corrects a block by removing an item', async () => {
    api.getInterpretation.mockResolvedValue(base);
    api.updateInterpretation.mockResolvedValue({ ...base, exclusions: [] });
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Single-company bets' }));
    expect(api.updateInterpretation).toHaveBeenCalledWith('int_1', { removeExclusionIds: ['x1'] }, { token: undefined });
    expect(await screen.findAllByText('None identified')).not.toHaveLength(0);
  });

  it('shows insufficient representation as a valid answer with a path back', async () => {
    api.getInterpretation.mockResolvedValue({ ...base, representation: 'insufficient', limitations: ['No approved instrument fits.'] });
    setup();
    expect(await screen.findByRole('heading', { name: 'We cannot represent this thesis yet' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Choose a suggested thesis' }));
    expect(await screen.findByText('discovery page')).toBeInTheDocument();
  });

  it('shows an error with retry when loading fails', async () => {
    api.getInterpretation.mockRejectedValueOnce(new ApiError({ status: 404, code: 'NOT_FOUND' }));
    api.getInterpretation.mockResolvedValue(base);
    setup();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('AI will reshape data centers')).toBeInTheDocument();
  });
});
