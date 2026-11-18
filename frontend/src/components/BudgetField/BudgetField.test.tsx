import { fireEvent, render, screen } from '@testing-library/react';
import { BudgetField } from './BudgetField';

describe('BudgetField', () => {
  it('is controlled and shows the default label, note and unit', () => {
    const onChange = vi.fn();
    render(<BudgetField value="500" onChange={onChange} />);
    const input = screen.getByLabelText('Planned budget');
    expect(input).toHaveValue('500');
    expect(screen.getByText('USDC')).toBeInTheDocument();
    expect(input).toHaveAccessibleDescription(/Nothing is bought yet/);
    fireEvent.change(input, { target: { value: '750' } });
    expect(onChange).toHaveBeenCalledWith('750');
    expect(input).toHaveValue('500');
  });
});
