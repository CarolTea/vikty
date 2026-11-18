import { apiErrorFromBody, ApiError, type HttpMethod, type RequestOptions, type Transport } from './transport';

export const DEFAULT_API_URL = 'http://localhost:3001/api/v1';

export function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
  const url = `${baseUrl.replace(/\/+$/, '')}${path}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

export function createHttpTransport(baseUrl: string = import.meta.env.VITE_API_URL ?? DEFAULT_API_URL): Transport {
  return {
    async request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (options.body !== undefined) headers['Content-Type'] = 'application/json';
      if (options.token) headers.Authorization = `Bearer ${options.token}`;
      if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

      let response: Response;
      try {
        response = await fetch(buildUrl(baseUrl, path, options.query), {
          method,
          headers,
          credentials: 'include',
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
      } catch {
        throw new ApiError({ status: 0, code: 'NETWORK_ERROR' });
      }

      const text = response.status === 204 ? '' : await response.text();
      let parsed: unknown;
      try {
        parsed = text ? JSON.parse(text) : undefined;
      } catch {
        parsed = undefined;
      }
      if (!response.ok) throw apiErrorFromBody(response.status, parsed, response.headers.get('Retry-After'));
      return parsed as T;
    },
  };
}
