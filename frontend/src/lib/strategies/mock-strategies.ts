import type { PublicStrategy } from "./types";

// Static demo strategies. Fictional creators; performance and followers are illustrative only.
export const demoStrategies: PublicStrategy[] = [
  {
    id: "demo-robotics-decade",
    creatorHandle: "maya",
    creatorName: "Maya",
    title: "The Robotics Decade",
    thesisSummary: "Robots and AI hardware will move from factories into everyday work over the next ten years.",
    themes: ["Robotics", "AI hardware", "Compute", "Energy"],
    visibility: "public",
    simulatedPerformance: 12.4,
    followers: 1284,
    isDemo: true,
    exposures: [
      { name: "Robotics & automation", weight: 35 },
      { name: "AI hardware", weight: 30 },
      { name: "Compute", weight: 20 },
      { name: "Energy", weight: 15 },
    ],
    composition: [
      { ticker: "ISRG", name: "Intuitive Surgical", allocation: 20 },
      { ticker: "ROK", name: "Rockwell Automation", allocation: 15 },
      { ticker: "NVDA", name: "NVIDIA", allocation: 30 },
      { ticker: "AMD", name: "AMD", allocation: 20 },
      { ticker: "NEE", name: "NextEra Energy", allocation: 15 },
    ],
    rationale: "Automation needs physical machines, the chips that run them and the power to sustain them.",
    risks: ["Slower adoption than expected", "Semiconductor cycles", "Concentration in a few companies"],
  },
  {
    id: "demo-brazil-rate-cycle",
    creatorHandle: "lucas",
    creatorName: "Lucas",
    title: "Brazil Rate Cycle",
    thesisSummary: "Brazil's interest rate cycle will turn, supporting local equities and fixed income.",
    themes: ["Brazil", "Equities", "Rates", "Fixed Income"],
    visibility: "public",
    simulatedPerformance: 6.8,
    followers: 642,
    isDemo: true,
    exposures: [
      { name: "Brazilian equities", weight: 45 },
      { name: "Fixed income", weight: 35 },
      { name: "Rate-sensitive sectors", weight: 20 },
    ],
    composition: [
      { ticker: "EWZ", name: "iShares MSCI Brazil", allocation: 45 },
      { ticker: "ITUB", name: "Itaú Unibanco", allocation: 20 },
      { ticker: "USDC", name: "USD Coin (stable reserve)", allocation: 35 },
    ],
    rationale: "Falling rates tend to lower financing costs and lift valuations for domestic companies.",
    risks: ["Inflation surprises", "Currency volatility", "Political and fiscal risk"],
  },
];
