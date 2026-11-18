import { createClient } from "@supabase/supabase-js";
import type { RunTrace, State } from "../../shared/types";
import { clean } from "./sanitize.js";

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
const sb = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

// Server-side write limiter: at most WRITES_PER_MIN database saves per minute.
const LIMIT = Number(process.env.DB_WRITES_PER_MIN || 30);
const stamps: number[] = [];
function allowWrite() {
  const now = Date.now();
  while (stamps.length && now - stamps[0] > 60_000) stamps.shift();
  if (stamps.length >= LIMIT) return false;
  stamps.push(now); return true;
}

const AREAS = new Set(["reading", "venue", "schedule", "food", "judging", "budget"]);
const SOURCES = new Set(["model", "validator", "skipped"]);
const int = (n: unknown) => Math.max(0, Math.min(2_000_000_000, Math.trunc(Number(n) || 0)));

/**
 * Best-effort save. SQL injection: supabase-js sends values as JSON to PostgREST, which binds them as
 * parameters, so no SQL string is ever built here. We also whitelist columns and clean every value.
 */
export async function persist(run: RunTrace, st: State, input: string, rejectedReason?: { reason: string; source: "model" | "validator" | "skipped" }) {
  if (!sb) return;
  if (!allowWrite()) { console.warn("[supabase] write skipped: rate limit reached"); return; }
  try {
    const { data, error } = await sb.from("runs").insert({
      kind: run.kind === "update" ? "update" : "full",
      input_text: clean(input, 20000),
      facts: st.facts, plan: st.plan, checks: st.checks, steps: run.steps,
      valid: !!st.valid, total_tokens: int(run.total_tokens), duration_ms: int(run.ms),
    }).select("id").single();
    if (error) throw error;

    if (run.calls.length) {
      const { error: e2 } = await sb.from("trace_calls").insert(run.calls.map((c) => ({
        run_id: data.id, n: int(c.n), model: clean(c.model, 100),
        area: AREAS.has(c.area) ? c.area : "reading",
        input: clean(c.input, 60000), output: clean(c.output, 60000),
        prompt_tokens: int(c.prompt_tokens), output_tokens: int(c.output_tokens), total_tokens: int(c.total_tokens), ms: int(c.ms),
      })));
      if (e2) throw e2;
    }
    const rows = [
      ...(run.kind === "full" ? st.facts.ignored.map((i) => ({ message: `Message #${int(i.msg)}`, reason: clean(i.reason, 1000), source: "skipped" })) : []),
      ...(rejectedReason && SOURCES.has(rejectedReason.source) ? [{ message: clean(input, 5000), reason: clean(rejectedReason.reason, 2000), source: rejectedReason.source }] : []),
    ].map((r) => ({ run_id: data.id, ...r }));
    if (rows.length) { const { error: e3 } = await sb.from("rejected_messages").insert(rows); if (e3) throw e3; }
  } catch (e) {
    console.warn("[supabase] save failed:", (e as Error).message);
  }
}
