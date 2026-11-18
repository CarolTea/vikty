import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders content, quotes the thesis and fires actions', async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="Nothing matched"
        description="Try rephrasing."
        thesis="My thesis"
        actions={[{ label: 'Edit thesis', onClick }]}
        footnote="No funds moved."
      />,
    );
    expect(screen.getByRole('region', { name: 'Nothing matched' })).toBeInTheDocument();
    expect(screen.getByText('Try rephrasing.')).toBeInTheDocument();
    expect(screen.getByText('Your thesis')).toBeInTheDocument();
    expect(screen.getByText('My thesis')).toBeInTheDocument();
    expect(screen.getByText('No funds moved.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit thesis' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
