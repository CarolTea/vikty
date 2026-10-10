import { it } from "node:test";
import assert from "node:assert/strict";
import { ASSET_CATALOG, CATALOG_VERSION } from "../src/lib/assets/catalog";
import {
  CATALOG_TAGS,
  getCandidateAssets,
  getCatalogAsset,
  modelAsset,
} from "../src/lib/assets/catalog-utils";
import { proposeThesis } from "../src/lib/ai/engine.server";
import { MockAIProvider } from "../src/lib/demo/providers";
import { validateComposition } from "../src/lib/ai/validation";
import type { Exposure } from "../src/lib/demo/types";
import { regionalThesisCases } from "./fixtures/thesis-cases";

const exposures = (...ids: readonly string[]): Exposure[] =>
  ids.map((id) => ({ id, name: id, description: id }));
const newIds = [
  "ondo-pbr",
  "backpack-ewz",
  "etherfuse-tesouro",
  "transfero-brz",
  "etherfuse-cetes",
];
it("v2 retains all 30 v1 IDs and adds exactly five Solana representations", () => {
  const legacy = [
    "nvda",
    "amd",
    "avgo",
    "tsm",
    "msft",
    "aapl",
    "googl",
    "amzn",
    "meta",
    "vrt",
    "nee",
    "ceg",
    "xom",
    "v",
    "ma",
    "pypl",
    "crcl",
    "spy",
    "qqq",
    "smh",
    "xlu",
    "xle",
    "gld",
    "tlt",
    "sgov",
  ].map((id) => `ondo-${id}`);
  assert.equal(CATALOG_VERSION, "2026-10-06.v2");
  assert.deepEqual(
    ASSET_CATALOG.map((a) => a.id).sort(),
    [...legacy, "sol", "usdc", "pyusd", "usdy", "ousg", ...newIds].sort(),
  );
  for (const asset of ASSET_CATALOG) {
    assert.ok(["us", "brazil", "latam", "global"].includes(asset.region));
    assert.equal(asset.executionStatus, "demo-only");
    assert.equal(asset.chain, "solana");
    for (const key of ["address", "tokenAddress", "apy", "yield", "maturity", "liquidity"])
      assert.ok(!(key in asset));
  }
});
it("regional metadata reaches the model without fixture prices", () => {
  for (const id of newIds) {
    const asset = modelAsset(getCatalogAsset(id)!);
    assert.equal(asset.availabilityScope, "provider-specific");
    assert.ok(asset.countryExposure?.length);
    assert.ok(asset.currencyExposure?.length);
    assert.ok(asset.marketExposure?.length);
    assert.ok(!("demoPrice" in asset));
  }
  assert.deepEqual(getCatalogAsset("etherfuse-cetes")?.countryExposure, ["MX"]);
  assert.deepEqual(getCatalogAsset("etherfuse-tesouro")?.currencyExposure, ["BRL"]);
  assert.equal(getCatalogAsset("ondo-tsm")?.region, "global");
  assert.deepEqual(getCatalogAsset("ondo-tsm")?.countryExposure, ["TW"]);
});
for (const fixture of regionalThesisCases) {
  it(`regional candidate constraints: ${fixture.id}`, () => {
    const result = getCandidateAssets(exposures(...fixture.tags));
    const ids = result.assets.map((a) => a.id);
    for (const id of fixture.expected) assert.ok(ids.includes(id), `${fixture.id}: missing ${id}`);
    for (const id of fixture.excluded)
      assert.ok(!ids.includes(id), `${fixture.id}: unexpected ${id}`);
    assert.equal(result.missingPrimary, !fixture.representable);
    if (!fixture.representable) {
      assert.deepEqual(ids, []);
      for (const tag of fixture.tags)
        assert.ok(result.limitations.some((text) => text.includes(tag)));
    }
  });
}
for (const [alias, assetId] of [
  ["Brazil", "backpack-ewz"],
  ["Brazilian economy", "backpack-ewz"],
  ["Brazilian stocks", "backpack-ewz"],
  ["Brazil growth", "backpack-ewz"],
  ["Brazilian energy", "ondo-pbr"],
  ["Petrobras", "ondo-pbr"],
  ["oil exports", "ondo-pbr"],
  ["commodity exports", "ondo-pbr"],
  ["Brazilian real", "transfero-brz"],
  ["BRL", "transfero-brz"],
  ["Brazilian interest rates", "etherfuse-tesouro"],
  ["Selic", "etherfuse-tesouro"],
  ["Brazilian fixed income", "etherfuse-tesouro"],
  ["Brazilian government bonds", "etherfuse-tesouro"],
  ["Brazil sovereign debt", "etherfuse-tesouro"],
  ["Mexican interest rates", "etherfuse-cetes"],
  ["Mexican government bonds", "etherfuse-cetes"],
  ["CETES", "etherfuse-cetes"],
  ["emerging markets", "backpack-ewz"],
]) {
  it(`maps semantic ID alias: ${alias}`, () => {
    assert.ok(getCandidateAssets(exposures(alias!)).assets.some((a) => a.id === assetId));
  });
}
it("geography or currency alone does not turn into arbitrary bonds or equities", () => {
  for (const id of ["Mexico", "Mexican economy", "MXN", "Latin America", "LatAm"]) {
    const result = getCandidateAssets(exposures(id));
    assert.deepEqual(result.assets, []);
    assert.equal(result.missingPrimary, true);
  }
  const brazil = getCandidateAssets(exposures("Brazil"));
  assert.equal(brazil.assets[0]?.id, "backpack-ewz");
  assert.ok(
    brazil.assets.every(
      (a) => a.instrumentType === "tokenized_equity" || a.instrumentType === "tokenized_etf",
    ),
  );
});
it("Brazil AI infrastructure permits thematic proxies with an explicit regional limitation", () => {
  const result = getCandidateAssets(exposures("brazil-ai-infrastructure"));
  assert.ok(result.assets.some((a) => a.id === "ondo-nvda"));
  assert.ok(result.assets.every((a) => !newIds.includes(a.id)));
  assert.ok(result.limitations.some((text) => text.includes("no direct Brazilian representation")));
});
it("unsupported sectors do not receive country-theme substitutions", () => {
  for (const id of [
    "brazil-small-caps",
    "latam-ecommerce",
    "latam-fintech",
    "emerging-market-consumption",
    "mexico-equities",
  ]) {
    assert.ok(CATALOG_TAGS.includes(id));
    const result = getCandidateAssets(exposures(id));
    assert.deepEqual(result.assets, []);
    assert.ok(result.limitations.some((text) => text.includes(id)));
  }
});
it("missing primary exposure blocks misleading complete portfolios", async () => {
  const provider = new MockAIProvider();
  let calls = 0;
  provider.proposeComposition = async () => {
    calls++;
    throw new Error("Must not generate");
  };
  const result = await proposeThesis(provider, "Brazil small caps and local fixed income", {
    summary: "Brazilian small caps and domestic fixed income benefit from lower rates",
    exposures: exposures("brazil-equities", "brazil-small-caps", "brazil-local-fixed-income").map(
      (e) => ({ ...e, importance: "primary" as const }),
    ),
    limitations: [],
  });
  assert.equal(calls, 0);
  assert.deepEqual(result.assets, []);
  assert.ok(result.limitations.some((text) => text.includes("brazil-small-caps")));
});
it("missing secondary exposure and representation limitations survive the engine", async () => {
  const provider = new MockAIProvider();
  provider.proposeComposition = async () => ({
    summary: "Broad Brazil proxy",
    assets: [
      {
        assetId: "backpack-ewz",
        allocation: 80,
        whyHere: "Broad Brazil",
        riskContext: "Concentration",
      },
    ],
    limitations: ["20% remains unassigned."],
  });
  const result = await proposeThesis(provider, "Brazil growth and local small caps", {
    summary: "Brazil equities with an unsupported small-cap component",
    exposures: [
      { ...exposures("brazil-equities")[0]!, importance: "primary" },
      { ...exposures("brazil-small-caps")[0]!, importance: "secondary" },
    ],
    limitations: [],
  });
  assert.deepEqual(
    result.assets.map((a) => a.id),
    ["backpack-ewz"],
  );
  assert.ok(result.limitations.some((text) => text.includes("brazil-small-caps")));
});
it("invented LatAm instruments fail existing allocation validation", () => {
  const allowed = getCandidateAssets(exposures("brazil-equities")).assets;
  for (const id of [
    "ondo-meli",
    "nubank",
    "stone",
    "xp",
    "pagseguro",
    "vale",
    "b3",
    "mexico-etf",
  ]) {
    assert.equal(getCatalogAsset(id), undefined);
    assert.throws(() =>
      validateComposition(
        {
          summary: "Invented asset",
          assets: [{ assetId: id, allocation: 100, whyHere: "Brazil", riskContext: "Risk" }],
          limitations: [],
        },
        allowed,
      ),
    );
  }
});

it("USD appreciation / BRL depreciation selects USD liquidity, never BRL cash or regional equities", () => {
  for (const tag of [
    "usd-liquidity",
    "usd-brl-appreciation",
    "brl-depreciation",
    "brazilian-real-depreciation",
  ]) {
    const result = getCandidateAssets(exposures(tag));
    assert.deepEqual(result.assets.map((asset) => asset.id).sort(), ["ondo-sgov", "pyusd", "usdc"]);
    assert.equal(result.missingPrimary, false);
    assert.ok(result.limitations.some((text) => text.includes("not USD/BRL derivatives")));
  }
  // An unspecified direction must not become a long-USD position automatically.
  assert.deepEqual(getCandidateAssets(exposures("usd-brl-exchange-rate")).assets, []);
  assert.deepEqual(
    getCandidateAssets(exposures("brl-liquidity")).assets.map((a) => a.id),
    ["transfero-brz"],
  );
});
