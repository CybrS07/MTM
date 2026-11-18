import type { Call, Facts, Plan, RunTrace, State, Step } from "../../shared/types";
import { callAI } from "./ai.js";
import { PATHS } from "./config.js";
import { buildPlan } from "./plan.js";
import { runChecks } from "./checks.js";
import { mergeFacts, normalize } from "./merge.js";
import { loadState, readText, saveState } from "./store.js";
import { persist } from "./db.js";
import { rs } from "./util.js";

const toCall = (n: number, c: any): Call => ({ n, area: "reading", ...c });

function areaSteps(p: Plan, f: Facts): Step[] {
  return [
    { area: "venue", level: "info", note: p.venue.why },
    { area: "schedule", level: "info", note: `${p.schedule.length} blocks. Judging takes ${p.judging.minutes} min (${p.judging.rounds} rounds). Prayer break ${f.event.prayer_break_min ?? 0} min.` },
    { area: "food", level: "info", note: `${p.food.boxes} ${p.food.tier} boxes × ${rs(p.food.price)} = ${rs(p.food.cost)}.` },
    { area: "judging", level: "info", note: `${p.judging.judges} of ${p.judging.confirmed} confirmed judges needed for ${p.teams} teams (max ${f.judging.max_teams_per_judge} each).` },
    { area: "budget", level: "info", note: `${rs(p.budget.total)} of ${rs(p.budget.limit)} used, ${rs(p.budget.remaining)} left.` },
  ];
}

function finish(kind: "full" | "update", message: string, calls: Call[], steps: Step[], t0: number, outcome: RunTrace["outcome"], id: number): RunTrace {
  return { id, kind, message, calls, steps, total_tokens: calls.reduce((s, c) => s + c.total_tokens, 0), ms: Date.now() - t0, at: new Date().toISOString(), outcome };
}

/** First run: one model call reads the whole pack, code does the rest. */
export async function runFull(): Promise<State> {
  const t0 = Date.now();
  const text = readText(PATHS.pack); // read from the file, exactly as given
  const ai = await callAI({ mode: "read", text });
  const facts = normalize(ai.parsed);
  const plan = buildPlan(facts);
  const checks = runChecks(facts, plan);
  const valid = checks.every((c) => c.pass);

  const steps: Step[] = [{ area: "reading", level: "info", note: "One model call read the full pack. All later steps are plain code (0 model calls)." }];
  for (const i of facts.ignored) steps.push({ area: "reading", level: "reject", note: `Message #${i.msg} not used: ${i.reason}` });
  for (const r of facts.requests) steps.push({ area: "budget", level: "reject", note: `${r.item} (${rs(r.amount)}) is a request, not an approved cost. Left out of the plan.` });
  steps.push(...areaSteps(plan, facts));
  for (const c of checks) steps.push({ area: "budget", level: c.pass ? "ok" : "reject", note: `Check "${c.label}": ${c.detail}` });

  const run = finish("full", text, [toCall(1, ai.call)], steps, t0, "applied", 1);
  const st: State = { facts, plan, checks, valid, runs: [run], rejected: [], updatedAt: run.at };
  st.rejected = facts.ignored.map((i) => ({ at: run.at, message: `Message #${i.msg}`, reason: i.reason, source: "skipped" as const }));
  saveState(st);
  await persist(run, st, text);
  return st;
}

/** Later message: one model call classifies it, code re-plans and validates. */
export async function runUpdate(): Promise<State> {
  const prev = loadState();
  if (!prev) throw new Error("Run the plan first, then send updates.");
  const t0 = Date.now();
  const text = readText(PATHS.update).trim();
  const ai = await callAI({ mode: "update", text, facts: prev.facts });
  const { kind, reason, patch } = ai.parsed as { kind: string; reason: string; patch: any };
  const id = prev.runs.length + 1;
  const steps: Step[] = [{ area: "reading", level: "info", note: `Model classified the message as "${kind}": ${reason}` }];
  const calls = [toCall(1, ai.call)];

  let next: Facts | null = null, nextPlan: Plan | null = null, failed: string[] = [];
  if (kind !== "irrelevant") {
    next = mergeFacts(prev.facts, patch ?? {});
    nextPlan = buildPlan(next);
    failed = runChecks(next, nextPlan).filter((c) => !c.pass).map((c) => `${c.label}: ${c.detail}`);
  }

  const reject = (source: "model" | "validator", why: string): State => {
    steps.push({ area: "reading", level: "reject", note: `Message rejected. ${why}` });
    steps.push({ area: "budget", level: "ok", note: "Previous plan kept. It is still valid." });
    const run = finish("update", text, calls, steps, t0, "rejected", id);
    const st: State = { ...prev, runs: [...prev.runs, run], rejected: [...prev.rejected, { at: run.at, message: text, reason: why, source }], updatedAt: run.at };
    saveState(st);
    void persist(run, st, text, { reason: why, source });
    return st;
  };

  if (kind === "irrelevant") {
    steps.push({ area: "reading", level: "info", note: "No plan area is affected. 0 areas recomputed." });
    const run = finish("update", text, calls, steps, t0, "skipped", id);
    const st: State = { ...prev, runs: [...prev.runs, run], rejected: [...prev.rejected, { at: run.at, message: text, reason: reason || "Not relevant to the plan.", source: "skipped" }], updatedAt: run.at };
    saveState(st);
    await persist(run, st, text, { reason: reason || "Not relevant", source: "skipped" });
    return st;
  }
  if (kind === "wrong") {
    const proof = failed.length ? ` Validator agrees: ${failed.join(" ")}` : "";
    const st = reject("model", `${reason}${proof}`);
    await Promise.resolve();
    return st;
  }
  if (failed.length) return reject("validator", `Applying it would break the plan. ${failed.join(" ")}`);

  // valid change: say which areas moved, recompute (already done in code)
  const checks = runChecks(next!, nextPlan!);
  const keys = ["venue", "schedule", "food", "judging", "budget"] as const;
  for (const k of keys) {
    const moved = JSON.stringify(prev.plan[k]) !== JSON.stringify(nextPlan![k]);
    steps.push({ area: k, level: moved ? "ok" : "info", note: moved ? `Recomputed in code. ${areaSteps(nextPlan!, next!).find((s) => s.area === k)!.note}` : "Unchanged." });
  }
  steps.push({ area: "budget", level: "ok", note: "Update accepted. All six checks pass." });
  const run = finish("update", text, calls, steps, t0, "applied", id);
  const st: State = { facts: next!, plan: nextPlan!, checks, valid: true, runs: [...prev.runs, run], rejected: prev.rejected, updatedAt: run.at };
  saveState(st);
  await persist(run, st, text);
  return st;
}
