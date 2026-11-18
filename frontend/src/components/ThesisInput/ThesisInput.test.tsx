import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { ThesisInput } from './ThesisInput';

const noop = () => undefined;

describe('ThesisInput', () => {
  it('disables interpret with a reason when the thesis is empty', () => {
    render(<ThesisInput value="  " onChange={noop} onSubmit={noop} />);
    expect(screen.getByRole('button', { name: 'Interpret' })).toBeDisabled();
    expect(screen.getByText('Write your thesis to continue')).toBeInTheDocument();
    expect(screen.getByText('2 / 600')).toBeInTheDocument();
  });

  it('shows the counter and calls onSubmit', async () => {
    const onSubmit = vi.fn();
    render(<ThesisInput value="AI infra" onChange={noop} onSubmit={onSubmit} maxChars={100} />);
    expect(screen.getByText('8 / 100')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Interpret' }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('reports typing through onChange', async () => {
    const onChange = vi.fn();
    render(<ThesisInput value="" onChange={onChange} onSubmit={noop} />);
    await userEvent.type(screen.getByLabelText('Your thesis'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('asks to connect when free interpretation is unavailable', async () => {
    const onConnect = vi.fn();
    render(<ThesisInput value="x" onChange={noop} onSubmit={noop} onConnect={onConnect} freeInterpretationAvailable={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Connect wallet to interpret' }));
    expect(onConnect).toHaveBeenCalledOnce();
  });

  it('disables interpret while busy', () => {
    render(<ThesisInput value="x" onChange={noop} onSubmit={noop} busy />);
    expect(screen.getByRole('button', { name: 'Interpret' })).toBeDisabled();
  });
});
