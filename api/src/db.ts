import { createClient } from "@supabase/supabase-js";
import type { RunTrace, State } from "../../shared/types";

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
const sb = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

/** Best-effort save to Supabase. A database problem never breaks planning. */
export async function persist(run: RunTrace, st: State, input: string, rejectedReason?: { reason: string; source: "model" | "validator" | "skipped" }) {
  if (!sb) return;
  try {
    const { data, error } = await sb.from("runs").insert({
      kind: run.kind, input_text: input, facts: st.facts, plan: st.plan, checks: st.checks, steps: run.steps,
      valid: st.valid, total_tokens: run.total_tokens, duration_ms: run.ms,
    }).select("id").single();
    if (error) throw error;
    if (run.calls.length) {
      const { error: e2 } = await sb.from("trace_calls").insert(run.calls.map((c) => ({ run_id: data.id, ...c })));
      if (e2) throw e2;
    }
    const rows = [
      ...st.facts.ignored.filter(() => run.kind === "full").map((i) => ({ run_id: data.id, message: `Message #${i.msg}`, reason: i.reason, source: "skipped" })),
      ...(rejectedReason ? [{ run_id: data.id, message: input, ...rejectedReason }] : []),
    ];
    if (rows.length) { const { error: e3 } = await sb.from("rejected_messages").insert(rows); if (e3) throw e3; }
  } catch (e) {
    console.warn("[supabase] save failed:", (e as Error).message);
  }
}
