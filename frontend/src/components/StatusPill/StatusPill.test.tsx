import { render, screen } from '@testing-library/react';
import { StatusPill } from './StatusPill';

describe('StatusPill', () => {
  it('has role=status only when live', () => {
    const { rerender } = render(<StatusPill tone="valid" live>Ready</StatusPill>);
    expect(screen.getByRole('status')).toHaveTextContent('Ready');
    rerender(<StatusPill tone="valid">Ready</StatusPill>);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
