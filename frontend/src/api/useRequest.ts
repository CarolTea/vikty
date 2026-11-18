import { useEffect, useRef, useState } from 'react';

export type RequestState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'error'; data?: undefined; error: unknown }
  | { status: 'success'; data: T; error?: undefined };

type Settled<T> = { key: string; data: T; error?: undefined } | { key: string; error: unknown; data?: undefined };

/**
 * Loads server state for a screen. Data always comes from the API (or its mock) and lives only in
 * memory: reloading the page fetches it again. `key` identifies the request (e.g. the resource id);
 * a new key loads again. `reload` retries after an error.
 */
export function useRequest<T>(key: string, load: () => Promise<T>): RequestState<T> & { reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const requestKey = `${key}#${attempt}`;
  useEffect(() => {
    let active = true;
    loadRef.current().then(
      (data) => active && setSettled({ key: requestKey, data }),
      (error: unknown) => active && setSettled({ key: requestKey, error }),
    );
    return () => {
      active = false;
    };
  }, [requestKey]);

  const reload = () => setAttempt((n) => n + 1);
  if (!settled || settled.key !== requestKey) return { status: 'loading', reload };
  if ('error' in settled && settled.error !== undefined) return { status: 'error', error: settled.error, reload };
  return { status: 'success', data: settled.data as T, reload };
}
