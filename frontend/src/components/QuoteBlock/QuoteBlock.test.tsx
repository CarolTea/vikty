import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuoteBlock } from './QuoteBlock';

describe('QuoteBlock', () => {
  it('renders the quoted text', () => {
    render(<QuoteBlock>My thesis</QuoteBlock>);
    expect(screen.getByText('My thesis')).toBeInTheDocument();
  });
});
