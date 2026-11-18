import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { ThesisCard } from './ThesisCard';

describe('ThesisCard', () => {
  it('renders title and summary and calls onUse', async () => {
    const onUse = vi.fn();
    render(<ThesisCard title="AI infra" summary="Compute for AI" onUse={onUse} />);
    expect(screen.getByRole('heading', { name: 'AI infra' })).toBeInTheDocument();
    expect(screen.getByText('Compute for AI')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Use and edit' }));
    expect(onUse).toHaveBeenCalledOnce();
  });
});
