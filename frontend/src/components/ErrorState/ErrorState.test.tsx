import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('shows title and message as an alert', () => {
    render(<ErrorState message="Network down" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('alert')).toHaveTextContent('Network down');
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('calls onRetry', async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="x" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
