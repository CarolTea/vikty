import { useCallback, useRef } from 'react';

/**
 * Idempotency keys for requests that must happen once. The same intent (same signature) keeps its key
 * until it succeeds, so a retry after a timeout cannot create a second operation; a later, new intent
 * gets a fresh key.
 */
export function useIntentKey() {
  const keys = useRef(new Map<string, string>());
  const keyFor = useCallback((intent: string) => {
    let key = keys.current.get(intent);
    if (!key) {
      key = crypto.randomUUID();
      keys.current.set(intent, key);
    }
    return key;
  }, []);
  const release = useCallback((intent: string) => void keys.current.delete(intent), []);
  return { keyFor, release };
}
