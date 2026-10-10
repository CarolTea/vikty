import { it } from "node:test";
import assert from "node:assert/strict";
import { thesisLanguage } from "../src/lib/ai/language";
import { getCandidateAssets } from "../src/lib/assets/catalog-utils";
import { proposeThesis } from "../src/lib/ai/engine.server";
import { MockAIProvider } from "../src/lib/demo/providers";

it("uses the original Portuguese/English belief and defaults neutral tickers to English", () => {
  for (const belief of [
    "Acredito que a demanda por energia vai crescer com a IA",
    "O dólar vai subir contra o real após as eleições",
    "Quero proteção contra desvalorização do real",
    "Juros brasileiros em queda",
  ])
    assert.equal(thesisLanguage(belief), "pt");
  for (const belief of [
    "I believe Brazil's interest rates will fall",
    "The dollar will rise against the real after the election",
    "USD BRL",
  ])
    assert.equal(thesisLanguage(belief), "en");
});
it("localizes every deterministic catalog warning without changing candidate selection", () => {
  const ids = [
    "brazil-small-caps",
    "brazil-ai-infrastructure",
    "brazil-domestic-consumption",
    "brazil-equities",
    "latam",
    "brl-liquidity",
    "brazil-local-fixed-income",
    "mexico-local-fixed-income",
    "usd-liquidity",
  ];
  for (const id of ids) {
    const exposures = [{ id, name: "Exposição econômica", description: "Teste" }];
    const en = getCandidateAssets(exposures);
    const pt = getCandidateAssets(exposures, undefined, "pt");
    assert.deepEqual(pt.assets, en.assets);
    assert.equal(pt.limitations.length, en.limitations.length);
    for (let i = 0; i < pt.limitations.length; i++)
      assert.notEqual(pt.limitations[i], en.limitations[i]);
    assert.doesNotMatch(pt.limitations.join(" "), /Only |The catalog|represents | were found/);
  }
});
it("does not carry stale pre-catalog conclusions into a composition and retains reassessed risks", async () => {
  const provider = new MockAIProvider();
  provider.proposeComposition = async ({ candidates, interpretation }) => {
    assert.ok(candidates.some((a) => a.id === "usdc"));
    assert.ok(interpretation.limitations.includes("Risco eleitoral"));
    return {
      summary: "Liquidez em dólar sujeita a riscos",
      assets: [
        {
          assetId: "usdc",
          allocation: 100,
          whyHere: "Liquidez em USD",
          riskContext: "Risco de emissor",
        },
      ],
      limitations: ["Risco eleitoral permanece; não há proteção garantida."],
    };
  };
  const result = await proposeThesis(provider, "Acredito que o dólar vai subir contra o real", {
    summary: "Liquidez em dólar diante da desvalorização do real",
    exposures: [
      { id: "usd-liquidity", name: "Liquidez em dólar", description: "USD", importance: "primary" },
    ],
    limitations: ["Nenhum catálogo de instrumentos candidatos foi fornecido.", "Risco eleitoral"],
  });
  assert.equal(result.assets[0]?.id, "usdc");
  assert.ok(result.limitations.some((text) => text.includes("Risco eleitoral")));
  assert.doesNotMatch(result.limitations.join(" "), /nenhum catálogo|Only |The catalog/i);
});
it("unrepresentable Portuguese theses return Portuguese summaries and coverage warnings", async () => {
  const result = await proposeThesis(
    new MockAIProvider(),
    "Acredito no crescimento de pequenas empresas brasileiras",
    {
      summary: "Crescimento de pequenas empresas brasileiras",
      exposures: [
        {
          id: "brazil-small-caps",
          name: "Pequenas empresas",
          description: "Brasil",
          importance: "primary",
        },
      ],
      limitations: [],
    },
  );
  assert.deepEqual(result.assets, []);
  assert.match(result.compositionSummary, /Esta tese/);
  assert.match(result.limitations.join(" "), /Nenhuma carteira/);
  assert.doesNotMatch(result.limitations.join(" "), /Only |The catalog|No complete/);
});
