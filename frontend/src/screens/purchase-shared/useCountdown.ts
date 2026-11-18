import { useEffect, useState } from 'react';

/** Whole seconds left until `expiresAt` (0 once past); undefined without a date. Ticks every second. */
export function useCountdown(expiresAt: string | undefined): number | undefined {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!expiresAt) return undefined;
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
}

/** 75 -> "1:15" */
export function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
