import test from "node:test";
import assert from "node:assert/strict";
import { buildPlan } from "../src/plan.js";
import { runChecks } from "../src/checks.js";
import { mergeFacts, normalize } from "../src/merge.js";
import { clean, csvSafe } from "../src/sanitize.js";

// Made-up event, not the hackathon pack.
const base = () => normalize({
  event: { hours: 5, students: 60, team_size: 4, budget: 400000, staff: 6, prayer_break_min: 20 },
  halls: [
    { name: "Small", seats: 50, price: 10000 },
    { name: "Mid", seats: 100, price: 50000 },
    { name: "Big", seats: 150, price: 90000, generator: true },
  ],
  meal: { standard_price: 700, basic_price: 500 },
  judging: { confirmed: 6, honorarium: 3000, minutes_per_team: 10, max_teams_per_judge: 5 },
  committed: [{ item: "prizes", amount: 20000 }],
});

test("plan figures and all six checks pass", () => {
  const f = base(), p = buildPlan(f);
  assert.equal(p.teams, 15);
  assert.equal(p.judging.judges, 3);
  assert.equal(p.people, 69);
  assert.equal(p.venue.hall?.name, "Mid");
  assert.equal(p.budget.total, 50000 + 69 * 700 + 3 * 3000 + 20000);
  assert.ok(runChecks(f, p).every((c) => c.pass));
});

test("a generator rule moves the venue", () => {
  const f = base(); f.event.needs_generator = true;
  assert.equal(buildPlan(f).venue.hall?.name, "Big");
});

test("a wrong order quantity is caught", () => {
  const f = mergeFacts(base(), { order_quantity: 40 });
  const bad = runChecks(f, buildPlan(f)).filter((c) => !c.pass);
  assert.equal(bad[0]?.id, "figures");
});

test("a legitimate change keeps the plan valid", () => {
  const f = mergeFacts(base(), { committed: [{ item: "prizes", amount: 25000 }] });
  const p = buildPlan(f);
  assert.equal(p.budget.total, 50000 + 69 * 700 + 9000 + 25000);
  assert.ok(runChecks(f, p).every((c) => c.pass));
});

test("a tiny budget fails the budget check", () => {
  const f = base(); f.event.budget = 100000;
  assert.equal(runChecks(f, buildPlan(f)).find((c) => c.id === "budget")?.pass, false);
});

test("sanitizers", () => {
  assert.ok(!clean("<script>alert(1)</script>hi").includes("<"));
  assert.ok(!clean("javascript:alert(1)").toLowerCase().includes("javascript:"));
  assert.ok(csvSafe("=1+1").startsWith("'"));
});
