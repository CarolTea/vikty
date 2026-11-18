import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import i18next from 'eslint-plugin-i18next'

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'src/api/schema.d.ts', 'src/api/mock/fixtures.json'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // No hard-coded on-screen text: JSX text and user-facing attributes must come from i18n.
    files: ['src/**/*.{ts,tsx}'],
    ...i18next.configs['flat/recommended'],
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          // Translation helpers (t, tc) are fine; so are lowercase identifier-like tokens ('done', 'a.b') used as state/keys.
          callees: { exclude: ['i18n(ext)?', 't', 'tc', 'require', 'addEventListener', 'removeEventListener', 'postMessage', 'getElementById', 'dispatch', 'commit', 'includes', 'indexOf', 'endsWith', 'startsWith'] },
          words: { exclude: ['[0-9!-/:-@[-`{-~]+', '[A-Z_-]+', '[a-z][a-zA-Z0-9_.:-]*', /^\p{Emoji}+$/u] },
          'jsx-attributes': {
            include: ['aria-label', 'aria-description', 'aria-placeholder', 'title', 'placeholder', 'alt', 'label', 'helperText', 'description', 'heading', 'caption', 'tooltip', 'text', 'message'],
          },
        },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**', 'scripts/**'],
    rules: { 'i18next/no-literal-string': 'off' },
  },
)
