import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '../../i18n';
import { Page } from './Page';

describe('Page', () => {
  it('renders landmarks, header slot and disclaimer', () => {
    render(<Page header={<header>Top</header>}><p>Body</p></Page>);
    expect(screen.getByRole('banner')).toHaveTextContent('Top');
    expect(screen.getByRole('main')).toHaveTextContent('Body');
    expect(screen.getByRole('contentinfo')).toHaveTextContent("VicTy doesn't provide financial advice.");
  });
});
