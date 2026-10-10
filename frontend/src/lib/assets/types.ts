export type InstrumentType =
  | "tokenized_equity"
  | "tokenized_etf"
  | "digital_asset"
  | "stablecoin"
  | "tokenized_commodity"
  | "tokenized_fixed_income";
export type AssetRegion = "us" | "brazil" | "latam" | "global";
export type CatalogAsset = {
  id: string;
  ticker: string;
  displayTicker: string;
  name: string;
  instrumentType: InstrumentType;
  provider: string;
  chain: "solana";
  region: AssetRegion;
  countryExposure?: readonly string[];
  currencyExposure?: readonly string[];
  marketExposure?: readonly string[];
  availabilityScope?: "demo" | "provider-specific";
  themes: readonly string[];
  exposures: readonly string[];
  riskTags: readonly string[];
  executionStatus: "demo-only";
  enabled: boolean;
  description: string;
  underlying?: string;
  issuer?: string;
  providerUrl: string;
  notes: string;
  // Fixtures only; never sent to OpenAI or represented as a market quote.
  demoPrice: number;
};
