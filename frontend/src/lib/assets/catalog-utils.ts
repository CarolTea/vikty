import type { ThesisLanguage } from "../ai/language";
import { ASSET_CATALOG } from "./catalog";
import type { CatalogAsset, InstrumentType } from "./types";
import type { Exposure } from "../demo/types";

const aliases: Record<string, string> = {
  "artificial-intelligence": "ai",
  "compute-infrastructure": "compute",
  "digital-infrastructure": "blockchain",
  "rwa-infrastructure": "tokenization",
  "real-world-assets": "rwa",
  "energy-demand": "energy",
  "electricity-demand": "electricity",
  "semiconductor-demand": "semiconductors",
  "gold-price": "gold",
  "digital-payments": "payments",
  "solana-ecosystem": "solana",
  "broad-us-equity": "us-equity",
  brazil: "brazil-equities",
  brazilian: "brazil-equities",
  "brazilian-economy": "brazil-equities",
  "brazilian-equities": "brazil-equities",
  "brazilian-stocks": "brazil-equities",
  "brazil-growth": "brazil-equities",
  "brazilian-consumer": "brazil-domestic-consumption",
  "brazilian-domestic-consumption": "brazil-domestic-consumption",
  "brazilian-energy": "brazil-energy",
  petrobras: "brazil-energy",
  "oil-exports": "commodity-exporters",
  "commodity-exports": "commodity-exporters",
  "brazil-commodity-exports": "commodity-exporters",
  "brazil-oil-exports": "brazil-energy",
  brl: "brl-liquidity",
  "us-dollar-liquidity": "usd-liquidity",
  "dollar-liquidity": "usd-liquidity",
  "usd-appreciation": "usd-liquidity",
  "usd-brl-appreciation": "usd-liquidity",
  "brl-depreciation": "usd-liquidity",
  "brazilian-real-depreciation": "usd-liquidity",
  "brazilian-interest-rates": "brazil-interest-rates",
  selic: "brazil-interest-rates",
  "brazilian-fixed-income": "brazil-local-fixed-income",
  "brazil-fixed-income": "brazil-local-fixed-income",
  "brazilian-local-fixed-income": "brazil-local-fixed-income",
  "brazilian-government-bonds": "brazil-sovereign-debt",
  "brazil-sovereign-debt": "brazil-sovereign-debt",
  "brazilian-small-caps": "brazil-small-caps",
  mexico: "mexico-economy",
  "mexican-economy": "mexico-economy",
  "mexican-interest-rates": "mexico-interest-rates",
  "mexican-government-bonds": "mexico-sovereign-debt",
  "mexican-fixed-income": "mexico-local-fixed-income",
  cetes: "mexico-sovereign-debt",
  mxn: "mxn-liquidity",
  "latin-america": "latam",
  "latin-american-ecommerce": "latam-ecommerce",
  "latin-american-fintech": "latam-fintech",
  "emerging-markets": "emerging-market-equities",
};
// Only these regional infrastructure exposures may use thematic proxies.
// No automatic stripping of country prefixes: it would turn local bonds into US bonds.
const regionalProxies: Record<string, readonly string[]> = {
  "brazil-ai": ["ai"],
  "brazil-ai-infrastructure": ["ai", "compute"],
  "brazil-data-centers": ["data-centers"],
  "brazil-data-center-infrastructure": ["data-centers"],
  "brazil-data-center-power": ["data-center-power"],
};
const regionalGaps = [
  "brazil-small-caps",
  "latam-ecommerce",
  "latam-fintech",
  "emerging-market-consumption",
  "mexico-equities",
  "mxn-liquidity",
  "latam",
  "brazil-domestic-consumption",
];
function normalizedId(id: string) {
  return id.trim().toLowerCase().replace(/\s+/g, "-");
}
function canonicalId(id: string) {
  const normalized = normalizedId(id);
  return aliases[normalized] ?? normalized;
}
export const CATALOG_TAGS = [
  ...new Set([
    ...ASSET_CATALOG.flatMap((a) => [...a.themes, ...a.exposures]),
    ...Object.values(aliases),
    ...Object.keys(regionalProxies),
    ...regionalGaps,
  ]),
].sort();
export function exposureTags(exposure: Pick<Exposure, "id">) {
  const id = normalizedId(exposure.id);
  return new Set([id, aliases[id] ?? id]);
}
export function matchesExposure(asset: CatalogAsset, exposure: Pick<Exposure, "id">) {
  const id = canonicalId(exposure.id);
  const proxy = regionalProxies[id];
  if (proxy) return proxy.some((tag) => [...asset.exposures, ...asset.themes].includes(tag));
  if (id === "brazil-domestic-consumption") return asset.id === "backpack-ewz";
  // Geography alone is not an economic exposure. Regional matches use explicit
  // exposure IDs, never broad country themes shared by equities, bonds and cash.
  if (/^(brazil|brl|mexico|mxn|latam|emerging-market)/.test(id))
    return asset.exposures.includes(id);
  const tags = exposureTags(exposure);
  return [...asset.exposures, ...asset.themes].some((tag) => tags.has(tag));
}
export function getCandidateAssets(
  exposures: Exposure[],
  types?: InstrumentType[],
  language: ThesisLanguage = "en",
) {
  const localized = (en: string, pt: string) => (language === "pt" ? pt : en);
  const ids = exposures.map((e) => canonicalId(e.id));
  const ranked = ASSET_CATALOG.filter(
    (a) => a.enabled && (!types || types.includes(a.instrumentType)),
  )
    .map((asset) => ({
      asset,
      score: exposures.reduce(
        (n, e) =>
          n +
          (matchesExposure(asset, e)
            ? (e.importance === "secondary" ? 1 : 3) +
              (asset.id === "backpack-ewz" && canonicalId(e.id) === "brazil-equities" ? 1 : 0)
            : 0),
        0,
      ),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.asset.id.localeCompare(b.asset.id));
  // Guarantee at least one representative per exposure before filling by score.
  const chosen = new Map<string, CatalogAsset>();
  for (const exposure of exposures) {
    const match = ranked.find((x) => matchesExposure(x.asset, exposure));
    if (match) chosen.set(match.asset.id, match.asset);
  }
  for (const { asset } of ranked) {
    if (chosen.size >= 15) break;
    chosen.set(asset.id, asset);
  }
  const assets = [...chosen.values()];
  const missing = exposures.filter((e) => !assets.some((a) => matchesExposure(a, e)));
  const limitations = missing.map((e) =>
    localized(
      `The catalog has no approved representation for ${e.name}.`,
      `O catálogo não possui uma representação aprovada para ${e.name}.`,
    ),
  );
  for (const e of exposures) {
    if (regionalProxies[canonicalId(e.id)] && assets.some((a) => matchesExposure(a, e)))
      limitations.push(
        localized(
          `The catalog has no direct Brazilian representation for ${e.name}. The candidates are thematic infrastructure proxies, not dedicated Brazilian exposure.`,
          `O catálogo não possui representação brasileira direta para ${e.name}. Os candidatos são aproximações temáticas de infraestrutura, não exposição dedicada ao Brasil.`,
        ),
      );
  }
  if (ids.includes("brazil-domestic-consumption") && assets.some((a) => a.id === "backpack-ewz"))
    limitations.push(
      localized(
        "EWZ offers broad Brazilian large- and mid-cap equities, not a dedicated domestic-consumption or small-cap portfolio.",
        "EWZ representa ações brasileiras de grande e médio porte, não uma carteira dedicada ao consumo doméstico ou a pequenas empresas.",
      ),
    );
  if (assets.some((a) => a.id === "ondo-pbr"))
    limitations.push(
      localized(
        "PBRon represents Petrobras, a single oil-and-gas company, not broad Brazilian-market exposure or all commodity exporters.",
        "PBRon representa a Petrobras, uma única empresa de petróleo e gás, não todo o mercado brasileiro ou todos os exportadores de commodities.",
      ),
    );
  if (ids.includes("emerging-market-equities") || ids.includes("latam"))
    limitations.push(
      localized(
        "The catalog has limited regional coverage, not a diversified Latin America or emerging-markets portfolio.",
        "O catálogo possui cobertura regional limitada, não uma carteira diversificada de América Latina ou mercados emergentes.",
      ),
    );
  if (assets.some((a) => a.id === "transfero-brz"))
    limitations.push(
      localized(
        "BRZ represents BRL liquidity, not Brazilian corporate growth or yield-bearing fixed income.",
        "BRZ representa liquidez em reais, não crescimento de empresas brasileiras ou renda fixa com juros.",
      ),
    );
  if (assets.some((a) => a.id === "etherfuse-tesouro" || a.id === "etherfuse-cetes"))
    limitations.push(
      localized(
        "TESOURO and CETES represent local sovereign fixed income, not equities. Their returns, maturity, liquidity and eligibility are not asserted by this demo.",
        "TESOURO e CETES representam renda fixa soberana local, não ações. A demo não informa rentabilidade, vencimento, liquidez ou elegibilidade atuais.",
      ),
    );
  if (ids.includes("usd-liquidity") && assets.some((a) => a.exposures.includes("usd-liquidity")))
    limitations.push(
      localized(
        "USD stablecoins represent dollar-denominated liquidity, not USD/BRL derivatives or guaranteed hedges. Issuer and depeg risks remain; simulated performance in USD does not measure returns in BRL.",
        "Stablecoins em USD representam liquidez em dólar, não derivativos USD/BRL ou proteção garantida. Há riscos de emissor e desancoragem; a performance simulada em USD não mede o retorno em reais.",
      ),
    );
  if (assets.length < 8)
    limitations.push(
      localized(
        `Only ${assets.length} relevant catalog instruments were found; unrelated assets will not be added to fill the portfolio.`,
        `Foram encontrados ${assets.length} instrumentos relevantes no catálogo; ativos sem relação com a tese não serão adicionados para completar a carteira.`,
      ),
    );
  return { assets, limitations, missingPrimary: missing.some((e) => e.importance !== "secondary") };
}
export function getCatalogAsset(id: string) {
  return ASSET_CATALOG.find((a) => a.id === id && a.enabled);
}
export function modelAsset(asset: CatalogAsset) {
  const {
    id,
    ticker,
    displayTicker,
    name,
    instrumentType,
    provider,
    chain,
    themes,
    exposures,
    riskTags,
    description,
    region,
    countryExposure,
    currencyExposure,
    marketExposure,
    availabilityScope,
  } = asset;
  return {
    id,
    ticker,
    displayTicker,
    name,
    instrumentType,
    provider,
    chain,
    themes,
    exposures,
    riskTags,
    description,
    region,
    countryExposure,
    currencyExposure,
    marketExposure,
    availabilityScope,
  };
}
