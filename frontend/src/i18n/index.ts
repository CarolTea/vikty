import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Every on-screen string lives in src/i18n/locales/<lang>/<namespace>.json; each file is a namespace.
const files = import.meta.glob<{ default: Record<string, unknown> }>('./locales/*/*.json', { eager: true });

const resources: Record<string, Record<string, Record<string, unknown>>> = {};
for (const [path, mod] of Object.entries(files)) {
  const match = /\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
  if (!match) continue;
  const [, lang, ns] = match as unknown as [string, string, string];
  (resources[lang] ??= {})[ns] = mod.default;
}

export const SUPPORTED_LANGUAGES = Object.keys(resources);

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
