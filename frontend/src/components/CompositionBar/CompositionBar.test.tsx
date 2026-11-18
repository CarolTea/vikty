import { render, screen } from '@testing-library/react';
import { CompositionBar } from './CompositionBar';

const segments = [
  { label: 'SOL', bps: 6000 },
  { label: 'USDC', bps: 4000 },
  { label: 'JUP', bps: 0, rejected: true },
];

describe('CompositionBar', () => {
  it('describes the bar and legend with labels and percentages', () => {
    render(<CompositionBar segments={segments} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'SOL 60%, USDC 40%, JUP 0%; total 100%');
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Composition' })).toBeInTheDocument();
  });

  it('shows a live status pill when statusText is given', () => {
    render(<CompositionBar segments={segments.slice(0, 1)} statusText="Weights must add up to 100%" />);
    expect(screen.getByRole('status')).toHaveTextContent('Weights must add up to 100%');
  });
});
