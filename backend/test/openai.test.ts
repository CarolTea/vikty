import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import OpenAI from 'openai';
import { OpenAIComposer, OpenAIExplainer, OpenAIInterpreter } from '../src/ai/openai.js';
import { buildApp } from '../src/app.js';
import type { ApiError } from '../src/errors.js';
import { AI_ANSWER, AI_COMPOSITION, AI_EXPLANATION, HUMAN_TOKEN, testDeps } from './helpers.js';

const CONVICTION = 'AI will increase demand for electricity.';

// An OpenAI client whose fetch answers each Responses call with the next queued output, and records
// the request bodies. No network.
function fakeOpenAI(outputs: { body: unknown; status?: string }[]) {
  const requests: Record<string, any>[] = [];
  const client = new OpenAI({
    apiKey: 'test-only',
    maxRetries: 0,
    fetch: async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      const next = outputs.shift();
      if (!next) return Response.json({ error: { message: 'unexpected call' } }, { status: 500 });
      return Response.json({
        id: `resp_${requests.length}`,
        object: 'response',
        model: 'test-model',
        status: next.status ?? 'completed',
        output: [
          {
            id: `msg_${requests.length}`,
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [{ type: 'output_text', text: JSON.stringify(next.body), annotations: [] }],
          },
        ],
      });
    },
  });
  return { interpreter: new OpenAIInterpreter(client, 'test-model'), composer: new OpenAIComposer(client, 'test-model'), explainer: new OpenAIExplainer(client, 'test-model'), requests };
}

const verdict = (v: string) => ({ body: { verdict: v } });

describe('OpenAIInterpreter', () => {
  it('checks the scope, then interprets', async () => {
    const { interpreter, requests } = fakeOpenAI([verdict('IN_SCOPE'), { body: AI_ANSWER }]);

    assert.deepEqual(await interpreter.interpret(CONVICTION), AI_ANSWER);
    assert.equal(requests.length, 2);
    const [scope, interpret] = requests;
    assert.match(scope!.instructions, /scope gate/);
    assert.equal(scope!.text.format.name, 'scope_check');
    assert.match(interpret!.instructions, /Operation: interpret\. Prompt version: interpret-v1/);
    assert.equal(interpret!.text.format.name, 'interpret');
    assert.equal(interpret!.text.format.strict, true);
    for (const r of requests) {
      assert.equal(r.model, 'test-model');
      assert.equal(r.store, false);
      // The conviction goes as data inside JSON, never spliced into the instructions.
      assert.deepEqual(JSON.parse(r.input), { conviction: CONVICTION });
      assert.ok(!r.instructions.includes(CONVICTION));
    }
  });

  for (const [v, reason] of [
    ['OUT_OF_SCOPE', 'unrelated'],
    ['NEEDS_CLARIFICATION', 'unclear'],
  ] as const) {
    it(`throws OUT_OF_SCOPE (${reason}) on ${v}, with no second call`, async () => {
      const { interpreter, requests } = fakeOpenAI([verdict(v)]);
      await assert.rejects(interpreter.interpret('What time is the Vasco game?'), (err: ApiError) => {
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, 'OUT_OF_SCOPE');
        assert.deepEqual(err.details, { reason });
        return true;
      });
      assert.equal(requests.length, 1);
    });
  }

  it('throws when the response is not completed', async () => {
    const { interpreter } = fakeOpenAI([verdict('IN_SCOPE'), { body: AI_ANSWER, status: 'incomplete' }]);
    await assert.rejects(interpreter.interpret(CONVICTION));
  });

  it('throws on an unknown verdict', async () => {
    const { interpreter, requests } = fakeOpenAI([verdict('MAYBE')]);
    await assert.rejects(interpreter.interpret(CONVICTION));
    assert.equal(requests.length, 1, 'never interprets past a broken gate');
  });

  it('throws on an interpretation outside the schema', async () => {
    const { interpreter } = fakeOpenAI([verdict('IN_SCOPE'), { body: { ...AI_ANSWER, tickers: ['NVDA'] } }]);
    await assert.rejects(interpreter.interpret(CONVICTION));
  });

  it('throws when the provider fails', async () => {
    const { interpreter } = fakeOpenAI([]);
    await assert.rejects(interpreter.interpret(CONVICTION));
  });
});

describe('POST /interpretations with the OpenAI adapter', () => {
  const post = (app: Awaited<ReturnType<typeof buildApp>>) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/interpretations',
      payload: { source: 'free_text', text: CONVICTION, botCheckToken: HUMAN_TOKEN },
    });

  it('returns 201 with the interpretation', async () => {
    const { interpreter } = fakeOpenAI([verdict('IN_SCOPE'), { body: AI_ANSWER }]);
    const app = await buildApp(testDeps({ interpreter }));
    const res = await post(app);

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.summary, AI_ANSWER.summary);
    assert.deepEqual(
      body.exposures.map((e: { label: string }) => e.label),
      AI_ANSWER.exposures,
    );
    assert.equal(body.status, 'needs_clarification');
    await app.close();
  });

  it('returns 422 OUT_OF_SCOPE and gives the free interpretation back for an out-of-scope text', async () => {
    const { interpreter } = fakeOpenAI([verdict('OUT_OF_SCOPE')]);
    const deps = testDeps({ interpreter });
    const app = await buildApp(deps);
    const res = await post(app);

    assert.equal(res.statusCode, 422);
    assert.equal(res.json().error.code, 'OUT_OF_SCOPE');
    assert.deepEqual(res.json().error.details, { reason: 'unrelated' });
    assert.ok([...deps.quota.anon.values()].every((n) => n === 0), 'quota returned');
    assert.equal(deps.interpretations.records.length, 0, 'nothing stored');
    await app.close();
  });

  it('returns 503 AI_UNAVAILABLE and gives the free interpretation back when OpenAI fails', async () => {
    const { interpreter } = fakeOpenAI([]);
    const deps = testDeps({ interpreter });
    const app = await buildApp(deps);
    const res = await post(app);

    assert.equal(res.statusCode, 503);
    assert.equal(res.json().error.code, 'AI_UNAVAILABLE');
    assert.ok([...deps.quota.anon.values()].every((n) => n === 0), 'quota returned');
    await app.close();
  });
});

describe('OpenAIComposer', () => {
  const input = {
    thesis: { summary: 'AI infrastructure.', exposures: [{ id: 'exp_1', label: 'AI semiconductors' }], exclusions: [], restrictions: [], answers: [] },
    candidates: [],
    policy: { minWeightBps: 500, maxWeightBps: 4000 },
  };

  it('makes one structured call with the input as data', async () => {
    const { composer, requests } = fakeOpenAI([{ body: AI_COMPOSITION }]);

    assert.deepEqual(await composer.compose(input), AI_COMPOSITION);
    assert.equal(requests.length, 1, 'no scope gate');
    const [request] = requests;
    assert.equal(request!.text.format.name, 'compose');
    assert.equal(request!.text.format.strict, true);
    assert.equal(request!.store, false);
    assert.match(request!.instructions, /Prompt version: compose-v2/);
    assert.deepEqual(JSON.parse(request!.input), input);
  });

  it('throws on an answer outside the schema or an incomplete response', async () => {
    await assert.rejects(fakeOpenAI([{ body: { ...AI_COMPOSITION, extra: 1 } }]).composer.compose(input));
    await assert.rejects(fakeOpenAI([{ body: AI_COMPOSITION, status: 'incomplete' }]).composer.compose(input));
  });
});

describe('OpenAIExplainer', () => {
  const input = {
    question: 'Why is NVDAon here?',
    instrumentId: 'ins_ondo_nvda',
    thesis: { summary: 'AI infrastructure.', exposures: [], exclusions: [], restrictions: [], answers: [] },
    items: [],
    limitations: [],
  };

  it('checks the question, then explains', async () => {
    const { explainer, requests } = fakeOpenAI([verdict('IN_SCOPE'), { body: AI_EXPLANATION }]);
    assert.deepEqual(await explainer.explain(input), AI_EXPLANATION);
    assert.equal(requests.length, 2);
    assert.equal(requests[0]!.text.format.name, 'explain_scope_check');
    assert.equal(JSON.parse(requests[0]!.input).question, input.question);
    assert.equal(requests[1]!.text.format.name, 'explain');
    assert.match(requests[1]!.instructions, /Prompt version: explain-v1/);
    assert.deepEqual(JSON.parse(requests[1]!.input), input);
  });

  it('throws OUT_OF_SCOPE with the question message when the gate says so', async () => {
    const { explainer, requests } = fakeOpenAI([verdict('OUT_OF_SCOPE')]);
    await assert.rejects(explainer.explain(input), (err: ApiError) => {
      assert.equal(err.code, 'OUT_OF_SCOPE');
      assert.equal(err.message, 'We can only answer questions about this thesis and its assets.');
      return true;
    });
    assert.equal(requests.length, 1);
  });
});
