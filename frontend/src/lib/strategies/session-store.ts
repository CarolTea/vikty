import { useSyncExternalStore } from "react";
import type { PublicStrategy } from "./types";

// Demonstration-only: published strategies live in memory for the open app session.
let published: PublicStrategy[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const empty: PublicStrategy[] = [];

export function publishStrategy(strategy: PublicStrategy) {
  published = [strategy, ...published];
  emit();
}

export function clearPublishedStrategies() {
  published = [];
  emit();
}

export function usePublishedStrategies() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => published,
    () => empty,
  );
}
