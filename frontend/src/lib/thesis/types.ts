export type PerformancePoint = { date: string; value: number };

export type SavedAsset = {
  id: string;
  ticker: string;
  name: string;
  allocation: number;
  initialPrice: number;
  currentPrice: number;
  initialValue: number;
  currentValue: number;
  category: string;
  exposure: string;
  why: string;
  risks: string;
};

export type SavedThesis = {
  id: string;
  title: string;
  belief: string;
  interpretation: string;
  status: "demo";
  createdAt: string;
  initialAmount: number;
  currentValue: number;
  performancePercent: number;
  todayPercent: number;
  assets: SavedAsset[];
  snapshots: PerformancePoint[];
};