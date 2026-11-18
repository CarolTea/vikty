import { render, screen } from '@testing-library/react';
import i18n from '../../i18n';
import { ShowcaseScreen } from './ShowcaseScreen';

describe('ShowcaseScreen', () => {
  it('renders every section title', () => {
    render(<ShowcaseScreen />);
    const sections = i18n.getResourceBundle('en', 'showcase').sections as Record<string, string>;
    for (const title of Object.values(sections)) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
    }
  });
});
