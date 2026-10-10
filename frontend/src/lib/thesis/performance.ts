import type { DemoAsset } from "@/lib/demo/types";
import type { PerformancePoint } from "./types";

export interface PerformanceProvider {
  generate(seed: string, assets: DemoAsset[], initialValue: number, createdAt: Date): { snapshots: PerformancePoint[]; assetMultipliers: Record<string, number> };
}

function seededValue(seed: string) {
  let value = 2166136261;
  for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export class MockPerformanceProvider implements PerformanceProvider {
  generate(seed: string, assets: DemoAsset[], initialValue: number, createdAt: Date) {
    const random = seededValue(seed);
    const bias = (random() - 0.5) * 0.005;
    const snapshots: PerformancePoint[] = [];
    let value = initialValue;
    for (let day = 0; day < 31; day += 1) {
      if (day > 0) value *= 1 + bias + (random() - 0.5) * 0.028;
      const date = new Date(createdAt);
      date.setUTCDate(date.getUTCDate() - (30 - day));
      snapshots.push({ date: date.toISOString().slice(0, 10), value: Math.round(value * 100) / 100 });
    }
    const portfolioMultiplier = snapshots.at(-1)?.value ? (snapshots.at(-1)?.value ?? initialValue) / initialValue : 1;
    const assetMultipliers = Object.fromEntries(assets.map((asset) => [asset.id, Math.max(0.72, portfolioMultiplier + (random() - 0.5) * 0.18)]));
    return { snapshots, assetMultipliers };
  }
}

export const performanceProvider: PerformanceProvider = new MockPerformanceProvider();