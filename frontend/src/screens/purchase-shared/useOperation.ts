import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { isPolled } from './status';
import type { Operation } from './types';

const FAST_MS = 2000;
const SLOW_MS = 10000;
const FAST_WINDOW_MS = 2 * 60 * 1000;

interface State {
  id: string;
  operation?: Operation;
  error?: unknown;
}

/**
 * Loads an operation from the API (the URL id is the only thing kept, so a reload recovers it) and keeps
 * asking while the backend still moves it: every 2 s for the first 2 minutes, then every 10 s.
 */
export function useOperation(id: string, token: string) {
  const [state, setState] = useState<State>({ id });
  const [attempt, setAttempt] = useState(0);
  const lastRef = useRef<Operation | undefined>(undefined);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    lastRef.current = undefined;

    const tick = async () => {
      let next: number | undefined;
      try {
        const operation = await api.getOperation(id, { token });
        if (!active) return;
        lastRef.current = operation;
        setState({ id, operation });
        if (isPolled(operation.status)) next = Date.now() - startedAt < FAST_WINDOW_MS ? FAST_MS : SLOW_MS;
      } catch (error) {
        if (!active) return;
        setState((s) => ({ id, operation: s.id === id ? s.operation : undefined, error }));
        // A failed check while the operation is moving is not a failure of the operation: keep asking.
        if (lastRef.current && isPolled(lastRef.current.status)) next = SLOW_MS;
      }
      if (next !== undefined) timer = setTimeout(() => void tick(), next);
    };
    void tick();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, token, attempt]);

  /** Shows an operation an action just returned, without waiting for the next check. */
  const apply = useCallback(
    (operation: Operation) => {
      lastRef.current = operation;
      setState({ id, operation });
    },
    [id],
  );
  const reload = useCallback(() => {
    setState({ id });
    setAttempt((n) => n + 1);
  }, [id]);

  const current = state.id === id ? state : { id };
  return { operation: current.operation, error: current.error, loading: !current.operation && !current.error, apply, reload };
}
