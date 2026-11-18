import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Activity, Ban, Bot, CalendarClock, Download, FileText, LayoutDashboard, Loader2, LogOut, Moon, Play, ReceiptText, RefreshCw, ShieldAlert, Sun } from "lucide-react";
import type { State } from "../shared/types";
import { downloadCsv, getSample, getState, runPlan, sendUpdate } from "./api";
import { loadToken, saveToken } from "./planner/store";
import { SUPABASE_ON, supabase } from "./lib/supabase";
import { applyTheme, initialMode, type Mode } from "./theme";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import PlanView from "./components/PlanView";
import TraceView from "./components/TraceView";
import RejectedView from "./components/RejectedView";
import Receipts from "./components/Receipts";
import Assistant from "./components/Assistant";
import "./layout.css";

type Screen = "dashboard" | "input" | "plan" | "trace" | "rejected" | "update" | "receipts" | "assistant";
// needsLogin: these screens use Supabase directly, so they are hidden in no-login mode.
const NAV: { id: Screen; label: string; icon: typeof Bot; organizer?: boolean; needsLogin?: boolean }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "input", label: "Message input", icon: FileText },
  { id: "plan", label: "Event plan", icon: CalendarClock },
  { id: "trace", label: "AI agent trace", icon: Activity },
  { id: "rejected", label: "Conflicts and rejected", icon: Ban },
  { id: "update", label: "Update plan", icon: RefreshCw },
  { id: "receipts", label: "Receipts", icon: ReceiptText, needsLogin: true },
  { id: "assistant", label: "AI assistant", icon: Bot, organizer: true, needsLogin: true },
];

export default function App() {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const guest = !SUPABASE_ON; // no Supabase keys in .env: open straight to the plan, no login
  const [organizer, setOrganizer] = useState(guest);
  const [st, setSt] = useState<State | null>(null);
  const [pack, setPack] = useState("");
  const [msg, setMsg] = useState("");
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [busy, setBusy] = useState<"run" | "update" | null>(null);
  const [err, setErr] = useState("");
  const [token, setToken] = useState(loadToken);

  useEffect(() => applyTheme(mode), [mode]);
  useEffect(() => {
    if (guest) return;
    // catch: if Supabase cannot be reached, show the login form instead of "Loading…" forever
    supabase.auth.getSession().then(({ data }) => setSession(data.session)).catch(() => setSession(null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [guest]);

  const uid = session?.user.id;
  useEffect(() => {
    const load = () => {
      getState().then(setSt).catch((e: Error) => setErr(e.message));
      getSample().then((s) => setPack(s.text)).catch(() => {});
    };
    if (guest) { load(); return; }
    if (!uid) { setOrganizer(false); setSt(null); return; }
    supabase.from("profiles").select("role").eq("id", uid).maybeSingle().then(({ data }) => setOrganizer(data?.role === "organizer"));
    load();
  }, [uid, guest]);

  if (!guest && session === undefined) return <p className="empty">Loading…</p>;
  if (!guest && !session) return <Login />;

  const go = async (kind: "run" | "update") => {
    setBusy(kind); setErr("");
    try {
      saveToken(token.trim());
      const next = kind === "run" ? await runPlan(token, pack) : await sendUpdate(token, msg);
      setSt(next);
      if (kind === "run") setScreen("plan");
      else { setMsg(""); setScreen(next.runs[next.runs.length - 1].outcome === "applied" ? "plan" : "rejected"); }
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  };

  const none = <p className="empty">No plan yet. Open Message input and plan the event.</p>;
  const lock = !organizer && <p className="muted">Only organizers can run or update the plan.</p>;

  return (
    <>
      <header className="top">
        <div className="brand">
          <span className="logo"><Bot size={22} /></span>
          <div><h1>Mind to Machine planner</h1><small>150 students · 50 teams · Islamabad</small></div>
        </div>
        <div className="who">
          <span>{guest ? "No-login mode" : `${session?.user.email} · ${organizer ? "organizer" : "student"}`}</span>
          <button className="btn icon-btn" aria-label="Switch theme" onClick={() => setMode(mode === "dark" ? "light" : "dark")}>{mode === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
          {!guest && <button className="btn icon-btn" aria-label="Sign out" onClick={() => supabase.auth.signOut()}><LogOut size={18} /></button>}
        </div>
      </header>

      <div className="shell">
        <nav className="nav" aria-label="Screens">
          {NAV.filter((n) => (!n.organizer || organizer) && (!n.needsLogin || !guest)).map(({ id, label, icon: Icon }) => (
            <button key={id} aria-current={screen === id ? "page" : undefined} onClick={() => setScreen(id)}><Icon size={18} /> {label}</button>
          ))}
        </nav>

        <main>
          {err && <div className="error" role="alert"><ShieldAlert size={18} /> {err}</div>}
          {screen === "dashboard" && <Dashboard st={st} />}
          {screen === "input" && (
            <section className="panel">
              <h2><FileText size={18} /> Message pack</h2>
              <textarea style={{ minHeight: "16rem" }} value={pack} onChange={(e) => setPack(e.target.value)} aria-label="Message pack" />
              <label className="muted" htmlFor="gem-token">Gemini API token (stays in this browser, sent only to Google)</label>
              <input id="gem-token" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste your free key from aistudio.google.com/apikey" />
              <div className="row">
                <button className="btn primary" disabled={!!busy || !pack.trim() || !token.trim() || !organizer} onClick={() => go("run")}>
                  {busy === "run" ? <Loader2 size={16} className="spin" /> : <Play size={16} />} Plan the event
                </button>
              </div>
              {lock}
            </section>
          )}
          {screen === "plan" && (st ? <PlanView st={st} /> : none)}
          {screen === "trace" && (st ? (
            <>
              <div className="row" style={{ marginBottom: ".8rem" }}>
                <button className="btn" onClick={() => downloadCsv(st)}><Download size={16} /> Trace table (CSV)</button>
                <button className="btn" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(st, null, 2)], { type: "application/json" })); a.download = "plan-and-trace.json"; a.click(); }}><Download size={16} /> Save plan and trace</button>
              </div>
              <TraceView st={st} />
            </>
          ) : none)}
          {screen === "rejected" && (st ? <RejectedView st={st} /> : none)}
          {screen === "update" && (
            <section className="panel">
              <h2><RefreshCw size={18} /> New message</h2>
              <textarea style={{ minHeight: "6rem" }} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Paste a message that arrived after the first run" aria-label="New message" />
              <label className="muted" htmlFor="gem-token">Gemini API token (stays in this browser, sent only to Google)</label>
              <input id="gem-token" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste your free key from aistudio.google.com/apikey" />
              <div className="row">
                <button className="btn primary" disabled={!!busy || !msg.trim() || !token.trim() || !st || !organizer} onClick={() => go("update")}>
                  {busy === "update" ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />} Update the plan
                </button>
              </div>
              {lock}
            </section>
          )}
          {screen === "receipts" && session && <Receipts userId={session.user.id} organizer={organizer} />}
          {screen === "assistant" && organizer && !guest && <Assistant />}
        </main>
      </div>
    </>
  );
}
