import {
  compositionSchema,
  answerSchema,
  type CompositionProposal,
  type ThesisAnswer,
} from "./schemas";
import { getCatalogAsset } from "../assets/catalog-utils";
import type { CatalogAsset } from "../assets/types";
import type { DemoAsset } from "../demo/types";

function validateAllocations(
  assets: CompositionProposal["assets"],
  allowed: readonly CatalogAsset[],
  limitations: string[],
) {
  const ids = new Set<string>();
  let total = 0;
  for (const asset of assets) {
    if (
      ids.has(asset.assetId) ||
      !allowed.some((a) => a.id === asset.assetId && a.enabled) ||
      !getCatalogAsset(asset.assetId)
    )
      throw new Error("Invalid or duplicate catalog asset");
    if (asset.allocation % 5 !== 0) throw new Error("Use allocation increments of five percent");
    ids.add(asset.assetId);
    total += asset.allocation;
  }
  if (total > 100 || (total < 100 && !limitations.length))
    throw new Error("Unexplained allocation total");
  return total;
}
export function validateComposition(value: unknown, allowed: readonly CatalogAsset[]) {
  const proposal = compositionSchema.parse(value);
  validateAllocations(proposal.assets, allowed, proposal.limitations);
  if (proposal.assets.some((a) => a.allocation === 0))
    throw new Error("Zero allocation is not a position");
  if (proposal.assets.length < Math.min(3, allowed.length) && !proposal.limitations.length)
    throw new Error("Insufficient representation must be explained");
  return proposal;
}
export function validateAnswer(
  value: unknown,
  allowed: readonly CatalogAsset[],
  current: AnswerInputAssets,
) {
  const answer = answerSchema.parse(value);
  if (answer.kind === "EXPLANATION_ONLY") {
    if (answer.changes.length) throw new Error("Explanation cannot modify allocations");
  } else {
    if (
      !answer.changes.length ||
      answer.changes.length !== current.length ||
      current.some((a) => !answer.changes.some((c) => c.assetId === a.id))
    )
      throw new Error("Proposal must describe the complete existing allocation");
    validateAllocations(answer.changes, allowed, answer.limitations);
    if (
      current.some(
        (a) => !a.active && answer.changes.some((c) => c.assetId === a.id && c.allocation > 0),
      )
    )
      throw new Error("Rejected assets cannot be silently restored");
  }
  return answer;
}
type AnswerInputAssets = Array<{ id: string; active: boolean }>;
export function hydrateAsset(proposal: CompositionProposal["assets"][number]): DemoAsset {
  const asset = getCatalogAsset(proposal.assetId);
  if (!asset) throw new Error("Catalog asset unavailable");
  return {
    id: asset.id,
    ticker: asset.displayTicker,
    name: asset.name,
    allocation: proposal.allocation,
    exposure: asset.exposures.slice(0, 2).join(" · "),
    why: proposal.whyHere,
    risks: `${asset.riskTags.slice(0, 2).join(" · ")}. ${proposal.riskContext}`.slice(0, 300),
    availability: "Demo only — execution simulated",
    category: asset.instrumentType.replaceAll("_", " "),
    price: asset.demoPrice,
    active: proposal.allocation > 0,
  };
}
export function proposalToAssets(proposal: CompositionProposal | Pick<ThesisAnswer, "changes">) {
  return ("assets" in proposal ? proposal.assets : proposal.changes).map(hydrateAsset);
}
