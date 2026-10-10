import type { SavedAsset, SavedThesis } from "./types";

function percent(current: number, initial: number) {
  return initial > 0 ? ((current - initial) / initial) * 100 : 0;
}

export type ThesisRow = {
  id: string;
  title: string;
  original_belief: string;
  interpreted_thesis: string;
  status: string;
  created_at: string;
  compositions: CompositionRow | CompositionRow[] | null;
};

export type CompositionRow = {
  id: string;
  initial_amount: number;
  current_simulated_value: number;
  composition_assets: Array<{
    id: string;
    asset_id: string;
    ticker: string;
    name: string;
    allocation_percent: number;
    initial_simulated_price: number;
    current_simulated_price: number;
    initial_value: number;
    current_value: number;
    category: string;
    exposure: string;
    why: string;
    risks: string;
  }>;
  performance_snapshots: Array<{ snapshot_date: string; value: number }>;
};

export function mapThesis(row: ThesisRow): SavedThesis {
  const composition = Array.isArray(row.compositions) ? row.compositions[0] : row.compositions;
  const initial = Number(composition?.initial_amount ?? 0);
  const current = Number(composition?.current_simulated_value ?? initial);
  const snapshots = (composition?.performance_snapshots ?? [])
    .map((point) => ({ date: point.snapshot_date, value: Number(point.value) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const previous = snapshots.at(-2)?.value ?? initial;
  const assets: SavedAsset[] = (composition?.composition_assets ?? []).map((asset) => ({
    id: asset.id,
    ticker: asset.ticker,
    name: asset.name,
    allocation: Number(asset.allocation_percent),
    initialPrice: Number(asset.initial_simulated_price),
    currentPrice: Number(asset.current_simulated_price),
    initialValue: Number(asset.initial_value),
    currentValue: Number(asset.current_value),
    category: asset.category,
    exposure: asset.exposure,
    why: asset.why,
    risks: asset.risks,
  }));
  return {
    id: row.id,
    title: row.title,
    belief: row.original_belief,
    interpretation: row.interpreted_thesis,
    status: "demo",
    createdAt: row.created_at,
    initialAmount: initial,
    currentValue: current,
    performancePercent: percent(current, initial),
    todayPercent: percent(current, previous),
    assets,
    snapshots,
  };
}

export const selection =
  "id, title, original_belief, interpreted_thesis, status, created_at, compositions!compositions_thesis_owner_fkey(id, initial_amount, current_simulated_value, composition_assets!composition_assets_owner_fkey(id, asset_id, ticker, name, allocation_percent, initial_simulated_price, current_simulated_price, initial_value, current_value, category, exposure, why, risks), performance_snapshots!performance_snapshots_owner_fkey(snapshot_date, value))";
