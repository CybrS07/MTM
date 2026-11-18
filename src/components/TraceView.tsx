import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { State } from "../../shared/types";

export default function TraceView({ st }: { st: State }) {
  const runs = [...st.runs].reverse();
  const grand = st.runs.reduce((s, r) => s + r.total_tokens, 0);
  return (
    <>
      {runs.map((r) => (
        <section className="panel" key={r.id}>
          <div className="run-head">
            <h2>Run {r.id}: {r.kind === "full" ? "full plan" : "update"}</h2>
            <span className="chip">{r.outcome} · {r.ms} ms · {r.total_tokens} tokens</span>
          </div>
          <div className="scroll">
            <table>
              <thead><tr><th>#</th><th>Model</th><th>Area</th><th className="num">In</th><th className="num">Out</th><th className="num">Total</th></tr></thead>
              <tbody>
                {r.calls.map((c) => (
                  <tr key={c.n}>
                    <td>{c.n}</td><td>{c.model}</td><td><span className="chip">{c.area}</span></td>
                    <td className="num">{c.prompt_tokens}</td><td className="num">{c.output_tokens}</td><td className="num">{c.total_tokens}</td>
                  </tr>
                ))}
                <tr><th colSpan={5}>Total tokens</th><th className="num">{r.total_tokens}</th></tr>
              </tbody>
            </table>
          </div>
          {r.calls.map((c) => (
            <details key={c.n}>
              <summary>Call {c.n}: input and output</summary>
              <pre>{c.input}</pre><hr /><pre>{c.output}</pre>
            </details>
          ))}
          <h3 style={{ marginTop: "1rem", fontSize: "1rem" }}>What the system decided</h3>
          {r.steps.map((s, i) => (
            <div key={i} className={`step ${s.level}`}>
              {s.level === "reject" ? <AlertTriangle size={16} /> : s.level === "ok" ? <CheckCircle2 size={16} /> : <Info size={16} />}
              <span><span className="chip">{s.area}</span> {s.note}</span>
            </div>
          ))}
        </section>
      ))}
      <p className="muted">All runs: {grand} tokens.</p>
    </>
  );
}
