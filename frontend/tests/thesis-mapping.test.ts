import { it } from "node:test";
import assert from "node:assert/strict";
import { mapThesis, type ThesisRow, type CompositionRow } from "../src/lib/thesis/queries";

const composition: CompositionRow = {
  id: "composition",
  initial_amount: 1000,
  current_simulated_value: 1100,
  composition_assets: [
    {
      id: "saved-asset",
      asset_id: "asset",
      ticker: "DEMO",
      name: "Demo asset",
      allocation_percent: 100,
      initial_simulated_price: 10,
      current_simulated_price: 11,
      initial_value: 1000,
      current_value: 1100,
      category: "Demo",
      exposure: "Exposure",
      why: "Reason",
      risks: "Risk",
    },
  ],
  performance_snapshots: [
    { snapshot_date: "2026-10-02", value: 1100 },
    { snapshot_date: "2026-10-01", value: 1000 },
  ],
};
const row: ThesisRow = {
  id: "thesis",
  title: "Demo thesis",
  original_belief: "Belief",
  interpreted_thesis: "Interpretation",
  status: "demo",
  created_at: "2026-10-01",
  compositions: composition,
};

it("keeps assets and values when a unique thesis composition is returned as an object", () => {
  const thesis = mapThesis(row);
  assert.equal(thesis.assets[0]?.ticker, "DEMO");
  assert.equal(thesis.initialAmount, 1000);
  assert.equal(thesis.currentValue, 1100);
  assert.equal(thesis.performancePercent, 10);
  assert.equal(thesis.todayPercent, 10);
  assert.deepEqual(
    thesis.snapshots.map((point) => point.date),
    ["2026-10-01", "2026-10-02"],
  );
});
it("supports composition arrays from composite owner relationships", () => {
  assert.deepEqual(mapThesis({ ...row, compositions: [composition] }), mapThesis(row));
});
it("handles an absent composition without crashing or inventing assets", () => {
  for (const compositions of [null, []]) {
    const thesis = mapThesis({ ...row, compositions });
    assert.deepEqual(thesis.assets, []);
    assert.equal(thesis.initialAmount, 0);
    assert.equal(thesis.performancePercent, 0);
  }
});
