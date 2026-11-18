import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Notice } from './Notice';

describe('Notice', () => {
  it('announces danger as an alert with its title', () => {
    render(<Notice tone="danger" title="Failed">Try later</Notice>);
    expect(screen.getByRole('alert')).toHaveTextContent('FailedTry later');
  });
  it('uses a note role for info by default', () => {
    render(<Notice>Heads up</Notice>);
    expect(screen.getByRole('note')).toHaveTextContent('Heads up');
  });
});
