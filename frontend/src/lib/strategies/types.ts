export type StrategyExposure = { name: string; weight: number };

export type PublicStrategy = {
  id: string;
  creatorHandle: string;
  creatorName: string;
  title: string;
  thesisSummary: string;
  themes: string[];
  visibility: "public";
  /** Simulated percentage change. Always labeled as demo/simulated in UI. */
  simulatedPerformance: number;
  followers: number;
  isDemo: boolean;
  exposures: StrategyExposure[];
  composition: { ticker: string; name: string; allocation: number }[];
  rationale: string;
  risks: string[];
};
