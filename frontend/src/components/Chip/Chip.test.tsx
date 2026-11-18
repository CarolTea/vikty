import { render, screen } from '@testing-library/react';
import { Chip } from './Chip';

describe('Chip', () => {
  it('applies the tone class', () => {
    render(<Chip tone="warning">Careful</Chip>);
    expect(screen.getByText('Careful')).toHaveClass('vt-chip', 'vt-chip-warning');
  });
  it('neutral has no tone class', () => {
    render(<Chip>Plain</Chip>);
    expect(screen.getByText('Plain')).toHaveAttribute('class', 'vt-chip');
  });
});
