import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '../../i18n';
import { ProgressSteps } from './ProgressSteps';

describe('ProgressSteps', () => {
  it('numbers steps, marks the current one and announces states', () => {
    render(<ProgressSteps steps={['Reading the thesis', 'Picking assets', 'Composing']} current={1} />);
    expect(screen.getByText('1. Reading the thesis')).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).not.toHaveAttribute('aria-current');
    expect(items[0]).toHaveAttribute('aria-label', '1. Reading the thesis (done)');
    expect(items[1]).toHaveAttribute('aria-label', '2. Picking assets (in progress)');
    expect(items[2]).toHaveAttribute('aria-label', '3. Composing (pending)');
  });
});
