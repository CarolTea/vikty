// Builds src/api/mock/fixtures.json from the API contract's own examples.
// Usage (from frontend/): node scripts/build-mocks.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const specUrl = new URL('../../Docs/api/openapi.yaml', import.meta.url);
const outUrl = new URL('../src/api/mock/fixtures.json', import.meta.url);
const spec = parse(readFileSync(specUrl, 'utf8'));

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function resolve(node) {
  let current = node;
  while (current && typeof current === 'object' && typeof current.$ref === 'string') {
    const parts = current.$ref.replace(/^#\//, '').split('/');
    current = parts.reduce((acc, key) => acc?.[key], spec);
  }
  return current;
}

// First example of a media type: `example`, else the first entry of `examples`.
function firstExample(media) {
  if (!media) return undefined;
  if (media.example !== undefined) return media.example;
  const entries = Object.values(media.examples ?? {});
  const first = resolve(entries[0]);
  return first?.value;
}

// Every named example of a media type, so tests can ask for a specific state.
function namedExamples(media) {
  const entries = Object.entries(media?.examples ?? {});
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries.map(([name, value]) => [name, resolve(value)?.value]));
}

const fixtures = {};
for (const [path, item] of Object.entries(spec.paths)) {
  for (const method of METHODS) {
    const operation = item[method];
    if (!operation) continue;
    const responses = {};
    for (const [status, rawResponse] of Object.entries(operation.responses ?? {})) {
      const response = resolve(rawResponse);
      const body = firstExample(response?.content?.['application/json']);
      // 2xx without a body (e.g. 204) is still a valid answer; errors need an example.
      if (body !== undefined) {
        const examples = namedExamples(response?.content?.['application/json']);
        responses[status] = examples ? { body, examples } : { body };
      }
      else if (/^2/.test(status) && !response?.content) responses[status] = { body: null };
    }
    if (Object.keys(responses).length > 0) fixtures[`${method.toUpperCase()} ${path}`] = responses;
  }
}

writeFileSync(outUrl, `${JSON.stringify(fixtures, null, 2)}\n`);
console.log(`Wrote ${Object.keys(fixtures).length} operations to ${fileURLToPath(outUrl)}`);
