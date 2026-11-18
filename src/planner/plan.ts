import type { Facts, Plan, Block } from "../../shared/types";
import { POLICY } from "./config";
import { clock, rs } from "./util";

/** Plain code: all arithmetic lives here, no model involved. */
export function buildPlan(f: Facts): Plan {
  const e = f.event, j = f.judging;
  const teams = Math.ceil(e.students / Math.max(1, e.team_size));
  const judges = Math.max(1, Math.min(teams, Math.ceil(teams / Math.max(1, j.max_teams_per_judge))));
  const rounds = Math.ceil(teams / judges);
  const judgingMin = rounds * j.minutes_per_team;
  const people = e.students + e.staff + judges;

  // venue: cheapest hall that seats everyone (and has a generator if a rule needs it)
  const hall = f.halls
    .filter((h) => h.seats >= people && (!e.needs_generator || h.generator))
    .sort((a, b) => a.price - b.price)[0] ?? null;
  const why = hall
    ? `${hall.name} seats ${hall.seats} for ${people} people. Cheapest hall that fits (${rs(hall.price)})${e.needs_generator ? ", has a standby generator" : ""}.`
    : `No hall seats ${people} people${e.needs_generator ? " with a generator" : ""}.`;

  // food: standard box unless it breaks the budget, then basic
  const honoraria = judges * j.honorarium;
  const committed = f.committed.reduce((s, c) => s + c.amount, 0);
  const base = (hall?.price ?? 0) + honoraria + committed;
  const std = f.meal.standard_price, basic = f.meal.basic_price;
  let tier: Plan["food"]["tier"] = "none", price = 0;
  if (std != null) { tier = "standard"; price = std; }
  if (basic != null && (std == null || base + std * people > e.budget)) { tier = "basic"; price = basic; }
  const food = { tier, price, boxes: people, cost: price * people };

  // schedule
  const start = e.start_time || POLICY.defaultStart;
  const total = e.hours * 60, prayer = e.prayer_break_min || 0;
  const hack = Math.max(0, total - (POLICY.openingMin + POLICY.lunchMin + POLICY.closingMin + prayer + judgingMin));
  const h1 = Math.floor(hack / 2);
  const seq: [string, number, string][] = [
    ["Opening and briefing", POLICY.openingMin, "event"],
    ["Hacking, block 1", h1, "hack"],
    ["Lunch", POLICY.lunchMin, "meal"],
    ...(prayer ? ([["Prayer break", prayer, "prayer"]] as [string, number, string][]) : []),
    ["Hacking, block 2", hack - h1, "hack"],
    ["Judging", judgingMin, "judging"],
    ["Closing and prizes", POLICY.closingMin, "event"],
  ];
  let t = 0;
  const schedule: Block[] = seq.map(([label, minutes, kind]) => {
    const b = { label, minutes, kind, start: clock(start, t), end: clock(start, t + minutes) };
    t += minutes; return b;
  });

  // judging assignment: round r, judge i -> team r*judges+i+1
  const perJudge = Array.from({ length: judges }, (_, i) => ({
    judge: i + 1,
    teams: Array.from({ length: rounds }, (_, r) => r * judges + i + 1).filter((n) => n <= teams),
  }));

  const lines = [
    { item: `Venue: ${hall?.name ?? "none"}`, amount: hall?.price ?? 0 },
    { item: `Lunch: ${people} × ${rs(price)} (${tier})`, amount: food.cost },
    { item: `Judge honoraria: ${judges} × ${rs(j.honorarium)}`, amount: honoraria },
    ...f.committed.map((c) => ({ item: `Already ordered: ${c.item}`, amount: c.amount })),
  ];
  const sum = lines.reduce((s, l) => s + l.amount, 0);
  const remaining = e.budget - sum;
  return {
    teams, people,
    venue: { hall, why },
    schedule, food,
    judging: { judges, confirmed: j.confirmed, rounds, minutes: judgingMin, honorarium: j.honorarium, total: honoraria, perJudge },
    budget: { lines, total: sum, limit: e.budget, remaining },
    deferred: f.requests.map((r) => ({
      item: r.item, amount: r.amount,
      note: r.amount <= remaining ? "Not approved. Fits in the remaining budget if the Dean approves." : "Not approved. Would break the budget.",
    })),
  };
}
