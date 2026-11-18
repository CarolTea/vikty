import { fireEvent, render, screen } from '@testing-library/react';
import { WeightField } from './WeightField';

describe('WeightField', () => {
  it('shows percent from bps and amount, and reports bps on change', () => {
    const onChange = vi.fn();
    render(<WeightField weightBps={3500} amount="175" onChange={onChange} />);
    const input = screen.getByLabelText('Weight');
    expect(input).toHaveValue('35');
    expect(screen.getByText('175 USDC')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '12.5' } });
    expect(onChange).toHaveBeenCalledWith(1250);
  });

  it('shows a placeholder when the amount is missing', () => {
    render(<WeightField weightBps={3500} onChange={() => {}} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('links the error to the input', () => {
    render(<WeightField weightBps={3500} amount="175" error="Must be 0–100%" onChange={() => {}} />);
    const input = screen.getByLabelText('Weight');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Must be 0–100%');
  });
});
