import { apiErrorFromBody, ApiError, type HttpMethod, type RequestOptions, type Transport } from '../transport';
import fixtureData from './fixtures.json';

type Fixtures = Record<string, Record<string, { body: unknown; examples?: Record<string, unknown> }>>;
const fixtures = fixtureData as Fixtures;

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "GET /plans/{id}" becomes a method plus a regex that accepts any single segment for {id}.
const routes = Object.keys(fixtures).map((key) => {
  const [method, template] = key.split(' ') as [string, string];
  const pattern = template
    .split('/')
    .map((segment) => (/^\{.+\}$/.test(segment) ? '[^/]+' : escapeRegex(segment)))
    .join('/');
  return { key, method, regex: new RegExp(`^${pattern}$`) };
});

export interface MockOptions {
  /** Simulated latency in ms. Defaults to 300 outside tests. */
  latencyMs?: number;
  /** Force the response status to serve (e.g. 429); defaults to the first 2xx with an example. */
  status?: number;
}

const notFound = () => new ApiError({ status: 404, code: 'NOT_FOUND' });

/** Answers from the contract's own examples (see fixtures.json). */
export function createMockTransport(options: MockOptions = {}): Transport {
  const latencyMs = options.latencyMs ?? (import.meta.env.MODE === 'test' ? 0 : 300);
  return {
    async request<T>(method: HttpMethod, path: string, requestOptions?: RequestOptions): Promise<T> {
      if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
      const route = routes.find((r) => r.method === method && r.regex.test(path));
      const responses = route && fixtures[route.key];
      if (!responses) throw notFound();
      const status =
        options.status ??
        Object.keys(responses)
          .map(Number)
          .filter((s) => s >= 200 && s < 300)
          .sort()[0];
      const fixture = status === undefined ? undefined : responses[String(status)];
      if (!fixture || status === undefined) throw notFound();
      const chosenError = requestOptions?.mockExample;
      if (status >= 400) {
        const errorBody = chosenError !== undefined && fixture.examples && chosenError in fixture.examples ? fixture.examples[chosenError] : fixture.body;
        throw apiErrorFromBody(status, errorBody);
      }
      const chosen = requestOptions?.mockExample;
      const body = chosen !== undefined && fixture.examples && chosen in fixture.examples ? fixture.examples[chosen] : fixture.body;
      return (body ?? undefined) as T;
    },
  };
}
