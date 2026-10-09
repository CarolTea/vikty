import type {
  Clarification,
  Interpretation,
  CompositionInput,
  CompositionProposal,
  AnswerInput,
  ThesisAnswer,
} from "../ai/schemas";
import type { ThesisLanguage } from "../ai/language";
import { getCandidateAssets } from "../assets/catalog-utils";
import type { ApprovalTransport, WalletSnapshot, WalletChoice } from "./wallet-types";
import type { DemoAsset, DemoMessage, Exposure, SimulatedInvestment } from "./types";

export interface AIProvider {
  clarify(
    belief: string,
    answer?: string,
    count?: number,
    messages?: DemoMessage[],
  ): Promise<Clarification>;
  interpret(belief: string, messages: DemoMessage[]): Promise<Interpretation>;
  proposeComposition(input: CompositionInput): Promise<CompositionProposal>;
  answer(question: string, state: AnswerInput): Promise<ThesisAnswer>;
}

export interface WalletProvider {
  getSnapshot(): WalletSnapshot;
  subscribe(listener: () => void): () => void;
  discover(): Promise<readonly WalletChoice[]>;
  connect(walletId: string): Promise<void>;
  disconnect(): Promise<void>;
  signApproval(
    asset: DemoAsset,
    amount: number,
    transport: ApprovalTransport,
  ): Promise<SimulatedInvestment>;
  clearApproval(): void;
  dispose(): void;
}

export interface AssetCatalogProvider {
  getCandidates(
    exposures: Exposure[],
    language?: ThesisLanguage,
  ): ReturnType<typeof getCandidateAssets>;
}
export class VicTyAssetCatalogProvider implements AssetCatalogProvider {
  getCandidates(exposures: Exposure[], language: ThesisLanguage = "en") {
    return getCandidateAssets(exposures, undefined, language);
  }
}
export interface PriceProvider {
  plannedUsd(asset: DemoAsset, portfolioValue: number): number;
}
export interface ExecutionProvider {
  simulate(
    asset: DemoAsset,
    amount: number,
    approval: { walletAddress: string; approvedAt: string },
  ): Promise<SimulatedInvestment>;
}

// Explicit development fixture only. Production selection lives in provider.server.ts.
export class MockAIProvider implements AIProvider {
  async clarify(): Promise<Clarification> {
    return { ready: true, question: null, options: [], reason: "Explicit development fixture" };
  }
  async interpret(belief: string): Promise<Interpretation> {
    const tags = /gold/i.test(belief)
      ? ["gold"]
      : /electric|energy/i.test(belief)
        ? ["electricity"]
        : /stablecoin|payment/i.test(belief)
          ? ["payments", "stablecoins"]
          : /solana/i.test(belief)
            ? ["solana", "blockchain"]
            : /tokeniz|real.world/i.test(belief)
              ? ["tokenization", "rwa"]
              : /ai|compute/i.test(belief)
                ? ["ai", "semiconductors"]
                : ["unsupported-thesis"];
    return {
      summary: `Development mock interpretation of: ${belief}`,
      exposures: tags.map((id) => ({
        id,
        name: id,
        description: "Development fixture exposure",
        importance: "primary" as const,
      })),
      limitations: ["Explicit development mock; not a model response."],
    };
  }
  async proposeComposition(input: CompositionInput): Promise<CompositionProposal> {
    const assets = input.candidates.slice(0, 4);
    const base = assets.length ? Math.floor(100 / assets.length / 5) * 5 : 0;
    return {
      summary: "Development mock composition",
      assets: assets.map((a, i) => ({
        assetId: a.id,
        allocation: i === 0 ? 100 - base * (assets.length - 1) : base,
        whyHere: "Development exposure fixture",
        riskContext: "Simulated representation; instrument risks remain.",
      })),
      limitations: ["Explicit development mock; not a model response."],
    };
  }
  async answer(): Promise<ThesisAnswer> {
    return {
      kind: "EXPLANATION_ONLY",
      explanation: "Development mock explanation. Review the static exposure and risk metadata.",
      changes: [],
      limitations: ["Explicit development mock."],
    };
  }
}

export class MockPriceProvider implements PriceProvider {
  plannedUsd(asset: DemoAsset, portfolioValue: number) {
    return Math.round((portfolioValue * asset.allocation) / 100);
  }
}
export class MockExecutionProvider implements ExecutionProvider {
  async simulate(
    asset: DemoAsset,
    amount: number,
    approval: { walletAddress: string; approvedAt: string },
  ): Promise<SimulatedInvestment> {
    return {
      id: crypto.randomUUID(),
      assetId: asset.id,
      ticker: asset.ticker,
      amount,
      provider: "Jupiter demo",
      ...approval,
      walletApproval: "verified",
      network: "solana:devnet",
      route: `USDC → ${asset.ticker}`,
      status: "simulated",
      createdAt: new Date().toISOString(),
    };
  }
}

export const demoProviders = {
  assets: new VicTyAssetCatalogProvider(),
  prices: new MockPriceProvider(),
  execution: new MockExecutionProvider(),
};
