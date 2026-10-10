import { it } from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ASSET_CATALOG } from "../src/lib/assets/catalog";
import { getCandidateAssets, getCatalogAsset } from "../src/lib/assets/catalog-utils";
import { validateComposition, validateAnswer, hydrateAsset } from "../src/lib/ai/validation";
import {
  clarificationSchema,
  interpretationSchema,
  compositionSchema,
  answerSchema,
} from "../src/lib/ai/schemas";
import { OpenAIProvider } from "../src/lib/ai/openai.server";
import { getAIProvider } from "../src/lib/ai/provider.server";
import { proposeThesis, answerThesis } from "../src/lib/ai/engine.server";
import { MockAIProvider } from "../src/lib/demo/providers";
import { stateSchema } from "../src/lib/demo/schemas";
import { emptyDemoState } from "../src/lib/demo/types";
import { thesisCases } from "./fixtures/thesis-cases";

const candidates = getCandidateAssets([{ id: "ai", name: "AI", description: "Compute" }]).assets;
const item = (id = candidates[0]!.id, allocation = 100) => ({
  assetId: id,
  allocation,
  whyHere: "Represents this economic exposure.",
  riskContext: "Market and issuer risks remain.",
});
const proposal = (assets = [item()], limitations = ["Limited representation."]) => ({
  summary: "A proposed representation",
  assets,
  limitations,
});
it("catalog has 35 unique, typed, manually enabled simulation instruments", () => {
  assert.equal(ASSET_CATALOG.length, 35);
  assert.equal(new Set(ASSET_CATALOG.map((a) => a.id)).size, 35);
  for (const asset of ASSET_CATALOG) {
    assert.equal(asset.executionStatus, "demo-only");
    assert.ok(asset.themes.length && asset.exposures.length && asset.riskTags.length);
    assert.ok(asset.providerUrl.startsWith("https://"));
    for (const tag of [asset.id, ...asset.themes, ...asset.exposures, ...asset.riskTags])
      assert.match(tag, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  }
});
for (const fixture of thesisCases)
  it(`candidate evaluation: ${fixture.id}`, () => {
    const exposures = fixture.tags.map((id) => ({
      id,
      name: id,
      description: id,
      importance: "primary" as const,
    }));
    const result = getCandidateAssets(exposures);
    assert.ok(result.assets.length <= 15);
    if (fixture.representable)
      for (const expected of fixture.expected)
        assert.ok(
          result.assets.some((a) => a.id === expected),
          expected,
        );
    else assert.equal(result.assets.length, 0);
    if (result.assets.length < 8) assert.ok(result.limitations.length);
    assert.deepEqual(result, getCandidateAssets(exposures));
  });
it("different economic theses do not receive a fixed candidate composition", () => {
  const compute = getCandidateAssets([
    { id: "semiconductors", name: "Chips", description: "Chips" },
  ]).assets.map((a) => a.id);
  const power = getCandidateAssets([
    { id: "electricity", name: "Power", description: "Power" },
  ]).assets.map((a) => a.id);
  assert.notDeepEqual(compute, power);
  assert.ok(!power.includes("ondo-nvda"));
});
it("strict schemas reject invented metadata and all four compile to strict OpenAI formats", () => {
  for (const schema of [clarificationSchema, interpretationSchema, compositionSchema, answerSchema])
    assert.equal(zodTextFormat(schema, "test").strict, true);
  assert.throws(() => validateComposition({ ...proposal(), ticker: "FAKE" }, candidates));
  assert.throws(() => validateComposition(proposal([{ ...item(), price: 999 }]), candidates));
});
it("blocks invented/out-of-candidate/disabled IDs, duplicate assets and invalid totals", () => {
  for (const assets of [
    [item("invented")],
    [item("sol")],
    [item(), item()],
    [item(candidates[0]!.id, -5)],
    [item(candidates[0]!.id, 105)],
    [item(candidates[0]!.id, 33)],
  ])
    assert.throws(() => validateComposition(proposal(assets), candidates));
  assert.throws(() => validateComposition(proposal([item()], []), candidates));
  assert.throws(() =>
    validateComposition(
      proposal([item()]),
      candidates.map((a) => ({ ...a, enabled: false })),
    ),
  );
  assert.throws(() => validateComposition(proposal([item(candidates[0]!.id, 50)], []), candidates));
  assert.equal(
    validateComposition(proposal([item(candidates[0]!.id, 50)]), candidates).assets[0]!.allocation,
    50,
  );
});
it("hydrates identity and mock price from catalog, never model fields", () => {
  const data = hydrateAsset(item());
  const trusted = getCatalogAsset(item().assetId)!;
  assert.equal(data.name, trusted.name);
  assert.equal(data.ticker, trusted.displayTicker);
  assert.equal(data.price, trusted.demoPrice);
  assert.match(data.availability, /simulated/);
  assert.ok(stateSchema.safeParse({ ...emptyDemoState, assets: [data] }).success);
});
it("unsupported primary exposure returns an explicit gap without calling composition AI", async () => {
  const provider = new MockAIProvider();
  provider.proposeComposition = async () => {
    throw new Error("must not call");
  };
  const result = await proposeThesis(provider, "Unknown economic thesis", {
    summary: "A thesis outside this catalog",
    exposures: [
      {
        id: "lunar-hotels",
        name: "Lunar hotels",
        description: "Unrepresented",
        importance: "primary",
      },
    ],
    limitations: [],
  });
  assert.deepEqual(result.assets, []);
  assert.ok(result.limitations.length);
});
it("explanations cannot contain changes and rejected assets cannot be restored", () => {
  const current = [{ id: candidates[0]!.id, active: false }];
  assert.throws(() =>
    validateAnswer(
      { kind: "EXPLANATION_ONLY", explanation: "Why", changes: [item()], limitations: [] },
      candidates,
      current,
    ),
  );
  assert.throws(() =>
    validateAnswer(
      { kind: "PROPOSED_CHANGE", explanation: "Change", changes: [item()], limitations: [] },
      candidates,
      current,
    ),
  );
  assert.throws(() =>
    validateAnswer(
      { kind: "PROPOSED_CHANGE", explanation: "Change", changes: [], limitations: [] },
      candidates,
      current,
    ),
  );
});
it("a proposed change is returned separately without mutating state", async () => {
  const state = {
    belief: "I believe in computing infrastructure",
    interpretation: "A compute-related thesis",
    exposures: [],
    assets: [{ id: candidates[0]!.id, allocation: 100, active: true }],
  };
  const before = structuredClone(state);
  const provider = new MockAIProvider();
  provider.answer = async () => ({
    kind: "PROPOSED_CHANGE",
    explanation: "Reduce concentration",
    changes: [item(candidates[0]!.id, 50)],
    limitations: ["50% remains unallocated."],
  });
  const result = await answerThesis(provider, "Make this less volatile", state);
  assert.deepEqual(state, before);
  assert.equal(result.proposedAssets?.[0]?.allocation, 50);
});
function fakeClient(reply: unknown, requests: Record<string, unknown>[], httpStatus = 200) {
  return new OpenAI({
    apiKey: "test-only-not-a-secret",
    maxRetries: 0,
    fetch: async (_url, options) => {
      requests.push(JSON.parse(String(options?.body)));
      return new Response(
        JSON.stringify(
          httpStatus === 200
            ? {
                id: "resp_test",
                object: "response",
                status: "completed",
                model: "gpt-5.6-luna",
                output: [
                  {
                    id: "msg_test",
                    type: "message",
                    role: "assistant",
                    status: "completed",
                    content: [
                      {
                        type: "output_text",
                        text: JSON.stringify(
                          requests
                            .at(-1)
                            ?.instructions?.toString()
                            .includes("Operation: scope_check.")
                            ? { verdict: "IN_SCOPE", language: "en" }
                            : reply,
                        ),
                        annotations: [],
                      },
                    ],
                  },
                ],
                usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
              }
            : { error: { message: "private provider diagnostic", type: "server_error" } },
        ),
        { status: httpStatus, headers: { "Content-Type": "application/json" } },
      );
    },
  });
}
it("official SDK structured parsing uses bounded, server-only Responses requests", async () => {
  const requests: Record<string, unknown>[] = [];
  const provider = new OpenAIProvider(
    fakeClient({ ready: true, question: null, options: [], reason: "Clear exposure" }, requests),
  );
  const result = await provider.clarify("I believe AI compute will grow");
  assert.equal(result.ready, true);
  const request = requests[1]!;
  assert.equal(request.model, "gpt-5.6-luna");
  assert.equal(request.store, false);
  assert.equal(request.max_output_tokens, 1000);
  assert.equal(request.tools, undefined);
  const format = (request.text as { format: { type: string; strict: boolean } }).format;
  assert.equal(format.type, "json_schema");
  assert.equal(format.strict, true);
});
it("clarification limit still checks scope without another generation", async () => {
  const requests: Record<string, unknown>[] = [];
  const provider = new OpenAIProvider(fakeClient({}, requests));
  assert.equal((await provider.clarify("A belief", undefined, 3)).ready, true);
  assert.equal(requests.length, 1);
  assert.match(String(requests[0]!.instructions), /Operation: scope_check/);
});
it("Ask VicTy receives static trusted catalog fields and no browser-supplied identity, prices or secrets", async () => {
  const requests: Record<string, unknown>[] = [];
  const provider = new OpenAIProvider(
    fakeClient(
      { kind: "EXPLANATION_ONLY", explanation: "Static explanation", changes: [], limitations: [] },
      requests,
    ),
  );
  await provider.answer("Why is this here?", {
    belief: "Computing adoption will grow",
    interpretation: "Compute thesis",
    exposures: [],
    assets: [{ id: "ondo-nvda", allocation: 100, active: true }],
  });
  const input = String(requests[1]!.input);
  assert.ok(input.includes("NVIDIA"));
  for (const key of ["demoPrice", "price", "secret", "walletAddress", "investments"])
    assert.ok(!input.includes(`"${key}"`));
});
it("API failures stay recoverable, never reveal provider diagnostics or fallback to mock", async () => {
  const requests: Record<string, unknown>[] = [];
  const provider = new OpenAIProvider(fakeClient({}, requests, 500));
  await assert.rejects(
    () => provider.clarify("I believe AI compute will grow"),
    (error) =>
      error instanceof Error &&
      error.message.includes("try again") &&
      !error.message.includes("private provider"),
  );
  assert.equal(requests.length, 1);
});
it("production refuses explicit mock configuration", () => {
  const oldProvider = process.env.AI_PROVIDER,
    oldEnv = process.env.NODE_ENV;
  try {
    process.env.AI_PROVIDER = "mock";
    process.env.NODE_ENV = "production";
    assert.throws(() => getAIProvider(), /development/);
  } finally {
    if (oldProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = oldProvider;
    if (oldEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldEnv;
  }
});

it("refused or missing structured output is recoverable without a mock response", async () => {
  const requests: Record<string, unknown>[] = [];
  const provider = new OpenAIProvider(fakeClient(null, requests));
  await assert.rejects(
    () => provider.clarify("I believe compute demand will increase"),
    /try again/,
  );
});
it("oversized input is rejected before issuing a paid request", async () => {
  const requests: Record<string, unknown>[] = [];
  const provider = new OpenAIProvider(fakeClient({}, requests));
  await assert.rejects(() => provider.clarify("x".repeat(40_000)), /too large/);
  assert.equal(requests.length, 0);
});
it("model-created asset IDs are rejected through the real SDK provider path", async () => {
  const requests: Record<string, unknown>[] = [];
  const provider = new OpenAIProvider(fakeClient(proposal([item("invented")]), requests));
  await assert.rejects(
    () =>
      provider.proposeComposition({
        belief: "I believe compute demand will increase",
        interpretation: { summary: "A compute thesis", exposures: [], limitations: [] },
        candidates,
      }),
    /try again/,
  );
});
it("the official SDK retries a transient failure only once", async () => {
  let calls = 0;
  const client = new OpenAI({
    apiKey: "test-only-not-a-secret",
    maxRetries: 1,
    fetch: async () => {
      calls++;
      return new Response(
        JSON.stringify({ error: { message: "temporary", type: "server_error" } }),
        { status: 500, headers: { "Content-Type": "application/json", "retry-after-ms": "1" } },
      );
    },
  });
  await assert.rejects(
    () => new OpenAIProvider(client).clarify("I believe compute demand will increase"),
    /try again/,
  );
  assert.equal(calls, 2);
});
it("complete engine fixtures produce distinct compute and electricity portfolios", async () => {
  const outputIds: string[][] = [];
  for (const ids of [
    ["ondo-nvda", "ondo-amd", "ondo-vrt"],
    ["ondo-nee", "ondo-ceg", "ondo-xlu"],
  ]) {
    const tag = ids[0] === "ondo-nvda" ? "ai" : "electricity";
    const provider = new OpenAIProvider(
      fakeClient(
        proposal(
          ids.map((id, i) => item(id, i === 0 ? 40 : 30)),
          [],
        ),
        [],
      ),
    );
    const result = await proposeThesis(provider, `I believe ${tag} demand will grow`, {
      summary: `A thesis about ${tag} demand`,
      exposures: [{ id: tag, name: tag, description: tag, importance: "primary" }],
      limitations: [],
    });
    assert.equal(
      result.assets.reduce((n, a) => n + a.allocation, 0),
      100,
    );
    outputIds.push(result.assets.map((a) => a.id));
  }
  assert.notDeepEqual(outputIds[0], outputIds[1]);
});

it("Portuguese beliefs explicitly set the output language despite English context", async () => {
  const requests: Record<string, unknown>[] = [];
  const provider = new OpenAIProvider(
    fakeClient(
      { summary: "A demanda por energia deve aumentar", exposures: [], limitations: [] },
      requests,
    ),
  );
  await provider.interpret("Acredito que a demanda por energia vai crescer", [
    { id: "prior", role: "assistant", text: "Energy demand will grow" },
  ]);
  assert.match(String(requests[1]!.instructions), /Required output language: Portuguese/);
  assert.match(
    String(requests[1]!.instructions),
    /clarify and interpret receive a taxonomy, NOT candidate assets/,
  );
});
