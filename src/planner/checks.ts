import type { Check, Facts, Plan } from "../../shared/types";
import { rs } from "./util";

/** The six checks from the brief, in plain code. */
export function runChecks(f: Facts, p: Plan): Check[] {
  const e = f.event, j = f.judging;
  const mk = (id: string, label: string, bad: string[], ok: string): Check =>
    ({ id, label, pass: bad.length === 0, detail: bad.length ? bad.join(" ") : ok });

  const figures: string[] = [];
  if (p.teams * e.team_size < e.students) figures.push("Teams do not cover all students.");
  if (p.people !== e.students + e.staff + p.judging.judges) figures.push("Headcount does not add up.");
  if (p.budget.lines.reduce((s, l) => s + l.amount, 0) !== p.budget.total) figures.push("Budget lines do not add up.");
  if (p.food.boxes !== p.people) figures.push("Lunch boxes do not match headcount.");
  if (f.order_quantity != null && f.order_quantity < p.people)
    figures.push(`The caterer order of ${f.order_quantity} boxes is below the ${p.people} people to feed.`);
  if (p.food.tier === "none") figures.push("No lunch price is known.");

  const budget = p.budget.total > p.budget.limit ? [`Total ${rs(p.budget.total)} is over the ${rs(p.budget.limit)} budget.`] : [];

  const venue: string[] = [];
  if (!p.venue.hall) venue.push(p.venue.why);
  else {
    if (p.venue.hall.seats < p.people) venue.push(`${p.venue.hall.name} seats ${p.venue.hall.seats}, below ${p.people} people.`);
    if (e.needs_generator && !p.venue.hall.generator) venue.push("A generator is required and this hall has none.");
  }

  const sched: string[] = [];
  const mins = p.schedule.reduce((s, b) => s + b.minutes, 0);
  if (mins !== e.hours * 60) sched.push(`Blocks total ${mins} min, not ${e.hours * 60}.`);
  if (p.schedule.filter((b) => b.kind === "hack").some((b) => b.minutes <= 0)) sched.push("No time left for hacking.");
  if (e.prayer_break_min && !p.schedule.some((b) => b.kind === "prayer" && b.minutes >= e.prayer_break_min!)) sched.push("Prayer break missing.");
  if (p.judging.minutes < p.judging.rounds * j.minutes_per_team) sched.push("Judging block is too short.");

  const judges: string[] = [];
  if (p.judging.judges > j.confirmed) judges.push(`Need ${p.judging.judges} judges but only ${j.confirmed} confirmed.`);
  if (p.judging.judges * j.max_teams_per_judge < p.teams) judges.push("Judges cannot cover every team within their limit.");

  const areas: string[] = [];
  if (!p.venue.hall) areas.push("venue");
  if (!p.schedule.length) areas.push("schedule");
  if (!p.food.boxes) areas.push("food");
  if (!p.judging.judges) areas.push("judging");
  if (!p.budget.lines.length) areas.push("budget");

  return [
    mk("figures", "Figures correct", figures, `${p.teams} teams, ${p.people} people, all totals add up.`),
    mk("budget", "Within budget", budget, `${rs(p.budget.total)} of ${rs(p.budget.limit)}.`),
    mk("venue", "Venue fits", venue, p.venue.why),
    mk("schedule", "Schedule valid", sched, `${mins} minutes, prayer break and judging fit.`),
    mk("judges", "Enough judges", judges, `${p.judging.judges} judges, up to ${j.max_teams_per_judge} teams each.`),
    mk("areas", "All areas covered", areas.map((a) => `${a} is empty.`), "Venue, schedule, food, judging and budget are all planned."),
  ];
}
