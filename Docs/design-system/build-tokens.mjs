// Generates tokens.css from tokens.json. Run: node Docs/design-system/build-tokens.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('.', import.meta.url);
const t = JSON.parse(readFileSync(new URL('tokens.json', dir), 'utf8'));

const vars = [
  ...t.color.tokens,
  ...t.spacing.tokens,
  ...t.radius.tokens,
  ...t.shadow.tokens,
  ...t.layout.tokens,
  ...t.opacity.tokens,
  ...t.motion.tokens,
].map((x) => `  --${x.name}: ${x.value};`);
const families = Object.entries(t.type.families).map(([k, v]) => `  --font-${k}: ${v};`);

const styles = t.type.styles.map((s) => {
  const decl = [
    `font-family: var(--font-${s.family})`,
    `font-size: ${s.fontSize}`,
    `line-height: ${s.lineHeight}`,
    `font-weight: ${s.fontWeight}`,
    `letter-spacing: ${s.letterSpacing}`,
    s.textTransform && `text-transform: ${s.textTransform}`,
    s.family === 'mono' && 'font-variant-numeric: tabular-nums',
  ].filter(Boolean);
  return `.${s.name} { ${decl.join('; ')}; }`;
});

const css = [
  '/* Generated from tokens.json by build-tokens.mjs — do not edit by hand. */',
  ':root {',
  '  color-scheme: dark;',
  ...vars,
  ...families,
  '}',
  ...styles,
  '',
].join('\n');

writeFileSync(new URL('tokens.css', dir), css);
console.log('tokens.css written');
