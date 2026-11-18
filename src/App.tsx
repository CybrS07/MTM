import { useEffect, useState } from "react";
import { Activity, Ban, Bot, Download, FileText, Loader2, Moon, Play, Send, ShieldAlert, Sun } from "lucide-react";
import type { State } from "../shared/types";
import { getSample, getState, runPlan, sendUpdate } from "./api";
import { applyTheme, initialMode, type Mode } from "./theme";
import PlanView from "./components/PlanView";
import TraceView from "./components/TraceView";
import RejectedView from "./components/RejectedView";

type Tab = "plan" | "trace" | "rejected";

export default function App() {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [st, setSt] = useState<State | null>(null);
  const [pack, setPack] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<"run" | "update" | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<Tab>("plan");

  useEffect(() => applyTheme(mode), [mode]);
  useEffect(() => {
    getState().then(setSt).catch(() => {});
    getSample().then((s) => setPack(s.text)).catch(() => {});
  }, []);

  const go = async (kind: "run" | "update") => {
    setBusy(kind); setErr("");
    try {
      const next = kind === "run" ? await runPlan(pack) : await sendUpdate(msg);
      setSt(next);
      if (kind === "update") {
        setMsg("");
        setTab(next.runs[next.runs.length - 1].outcome === "applied" ? "plan" : "rejected");
      } else setTab("plan");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(st, null, 2)], { type: "application/json" }));
    a.download = "plan-and-trace.json"; a.click();
  };

  return (
    <>
      <header className="top">
        <div className="brand">
          <span className="logo"><Bot size={22} /></span>
          <div><h1>Mind to Machine planner</h1><small>150 students · 50 teams · Islamabad</small></div>
        </div>
        <button className="btn icon-btn" aria-label={`Switch to ${mode === "dark" ? "light" : "dark"} mode`} onClick={() => setMode(mode === "dark" ? "light" : "dark")}>
          {mode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <main className="layout">
        <aside>
          <section className="panel">
            <h2><FileText size={18} /> Message pack</h2>
            <textarea value={pack} onChange={(e) => setPack(e.target.value)} aria-label="Message pack" />
            <div className="row">
              <button className="btn primary" disabled={!!busy || !pack.trim()} onClick={() => go("run")}>
                {busy === "run" ? <Loader2 size={16} className="spin" /> : <Play size={16} />} Plan the event
              </button>
            </div>
          </section>
          <section className="panel">
            <h2><Send size={18} /> New message</h2>
            <textarea style={{ minHeight: "5rem" }} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Paste a message that arrived after the first run" aria-label="New message" />
            <div className="row">
              <button className="btn primary" disabled={!!busy || !msg.trim() || !st} onClick={() => go("update")}>
                {busy === "update" ? <Loader2 size={16} className="spin" /> : <Send size={16} />} Update the plan
              </button>
            </div>
            {!st && <p className="muted">Plan the event first, then send updates.</p>}
          </section>
          {err && <div className="error" role="alert"><ShieldAlert size={18} /> {err}</div>}
        </aside>

        <section>
          {!st ? (
            <p className="empty">No plan yet. Load the pack on the left and choose Plan the event.</p>
          ) : (
            <>
              <div className="tabs" role="tablist">
                <button className="tab" role="tab" aria-selected={tab === "plan"} onClick={() => setTab("plan")}><FileText size={16} /> Plan</button>
                <button className="tab" role="tab" aria-selected={tab === "trace"} onClick={() => setTab("trace")}><Activity size={16} /> Trace</button>
                <button className="tab" role="tab" aria-selected={tab === "rejected"} onClick={() => setTab("rejected")}><Ban size={16} /> Rejected <span className="count">{st.rejected.length}</span></button>
                <button className="btn" style={{ marginLeft: "auto" }} onClick={download}><Download size={16} /> Save plan and trace</button>
                <a className="btn" href="/api/export.csv" download><Download size={16} /> Trace table (CSV)</a>
              </div>
              {tab === "plan" && <PlanView st={st} />}
              {tab === "trace" && <TraceView st={st} />}
              {tab === "rejected" && <RejectedView st={st} />}
            </>
          )}
        </section>
      </main>
    </>
  );
}
