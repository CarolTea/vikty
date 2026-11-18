import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '../../i18n';
import { LoadingState } from './LoadingState';

describe('LoadingState', () => {
  it('shows the default message in a status region', () => {
    render(<LoadingState />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });
  it('shows a custom message', () => {
    render(<LoadingState message="Fetching quote" />);
    expect(screen.getByRole('status')).toHaveTextContent('Fetching quote');
  });
});
