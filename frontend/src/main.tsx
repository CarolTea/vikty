import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
// The design system is the only source of styles. Imported as modules so the dev server watches them.
import '../../Docs/design-system/tokens.css';
import '../../Docs/design-system/components.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
