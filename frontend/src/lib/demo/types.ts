export type DemoStep = "input" | "conversation" | "interpretation" | "composition";

export type DemoMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  options?: string[] | undefined;
};

export type Exposure = {
  id: string;
  name: string;
  description: string;
  importance?: "primary" | "secondary" | undefined;
};

export type DemoAsset = {
  id: string;
  ticker: string;
  name: string;
  allocation: number;
  exposure: string;
  why: string;
  risks: string;
  availability: string;
  category: string;
  price: number;
  active: boolean;
};

export type SimulatedInvestment = {
  id: string;
  assetId: string;
  ticker: string;
  amount: number;
  provider: string;
  route: string;
  status: "simulated";
  // Optional only for pre-wallet demo history. Never used as proof of approval.
  walletAddress?: string | undefined;
  walletApproval?: "verified" | undefined;
  network?: "solana:devnet" | undefined;
  approvedAt?: string | undefined;
  createdAt: string;
};

export type DemoState = {
  step: DemoStep;
  belief: string;
  messages: DemoMessage[];
  clarificationCount: number;
  interpretation: string;
  exposures: Exposure[];
  assets: DemoAsset[];
  investments: SimulatedInvestment[];
  limitations?: string[] | undefined;
  compositionSummary?: string | undefined;
  catalogVersion?: string | undefined;
};

export type DemoSessionCredentials = { id: string; secret: string };

export const emptyDemoState: DemoState = {
  step: "input",
  belief: "",
  messages: [],
  clarificationCount: 0,
  interpretation: "",
  exposures: [],
  assets: [],
  investments: [],
};
