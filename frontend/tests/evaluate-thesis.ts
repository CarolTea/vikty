// Explicit opt-in only: this performs paid model calls when configured.
import { OpenAIProvider } from "../src/lib/ai/openai.server";
import { proposeThesis } from "../src/lib/ai/engine.server";
import { thesisCases } from "./fixtures/thesis-cases";
if (!process.argv.includes("--live") || !process.env.OPENAI_API_KEY)
  throw new Error("Set OPENAI_API_KEY and pass --live to run the evaluation cases.");
const provider = new OpenAIProvider();
let failures = 0;
for (const fixture of thesisCases) {
  try {
    const interpretation = await provider.interpret(fixture.belief, []);
    const proposal = await proposeThesis(provider, fixture.belief, interpretation);
    const ids = proposal.assets.map((a) => a.id);
    const relevant = fixture.representable
      ? fixture.expected.some((id) => ids.includes(id))
      : ids.length === 0;
    if (!relevant) failures++;
    console.info({
      caseId: fixture.id,
      relevant,
      assetIds: ids,
      total: proposal.assets.reduce((n, a) => n + a.allocation, 0),
      limitationCount: proposal.limitations.length,
    });
  } catch {
    failures++;
    console.error({ caseId: fixture.id, status: "failed" });
  }
}
process.exitCode = failures ? 1 : 0;
