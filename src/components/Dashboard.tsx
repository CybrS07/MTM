import { useEffect, useState } from "react";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import type { State } from "../../shared/types";
import { supabase } from "../lib/supabase";

const rs = (n: number) => "Rs " + Math.round(n).toLocaleString("en-US");
interface Row { id: string; kind: string; valid: boolean; total_tokens: number; created_at: string }

export default function Dashboard({ st, organizer }: { st: State | null; organizer: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    if (!organizer) return;
    supabase.from("runs").select("id,kind,valid,total_tokens,created_at").order("created_at", { ascending: false }).limit(8)
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, [organizer, st?.updatedAt]);

  const tokens = st?.runs.reduce((s, r) => s + r.total_tokens, 0) ?? 0;
  const tiles: [string, string][] = st ? [
    ["Plan", st.valid ? "Valid" : "Needs fixing"], ["People", String(st.plan.people)], ["Teams", String(st.plan.teams)],
    ["Budget used", `${rs(st.plan.budget.total)} of ${rs(st.plan.budget.limit)}`], ["Tokens", String(tokens)], ["Rejected", String(st.rejected.length)],
  ] : [];

  return (
    <>
      {!st && <p className="empty">No plan yet. Open Message input and plan the event.</p>}
      <div className="tiles">{tiles.map(([k, v]) => <div className="tile" key={k}><span className="muted">{k}</span><b>{v}</b></div>)}</div>
      {st && <div className="checks">{st.checks.map((c) => (
        <div key={c.id} className={`check ${c.pass ? "pass" : "fail"}`}>
          {c.pass ? <CheckCircle2 size={20} /> : <ShieldAlert size={20} />}<div><b>{c.label}</b><span>{c.detail}</span></div>
        </div>))}</div>}
      {organizer && (
        <section className="panel">
          <h2>Run history</h2>
          {rows.length === 0 ? <p className="muted">Nothing saved yet.</p> : (
            <div className="scroll"><table>
              <thead><tr><th>When</th><th>Type</th><th>Valid</th><th className="num">Tokens</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.id}><td>{new Date(r.created_at).toLocaleString()}</td><td>{r.kind}</td><td>{r.valid ? "Yes" : "No"}</td><td className="num">{r.total_tokens}</td></tr>)}</tbody>
            </table></div>)}
        </section>
      )}
    </>
  );
}
