import { useState } from "react";
import { Bot, Loader2, Send, ShieldAlert } from "lucide-react";
import { fnMessage, supabase } from "../lib/supabase";

interface Turn { q: string; a: string }

export default function Assistant() {
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = q.trim();
    if (!question) return;
    setBusy(true); setErr("");
    const { data, error } = await supabase.functions.invoke("assistant", { body: { question } });
    if (error) setErr(await fnMessage(error)); else { setTurns((t) => [...t, { q: question, a: data.answer }]); setQ(""); }
    setBusy(false);
  };

  return (
    <>
      <form className="panel" onSubmit={ask}>
        <h2><Bot size={18} /> Ask about the plan</h2>
        <textarea style={{ minHeight: "4rem" }} maxLength={1000} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Why was the caterer's message rejected? How much budget is left?" aria-label="Question" />
        <div className="row"><button className="btn primary" disabled={busy || !q.trim()}>{busy ? <Loader2 size={16} className="spin" /> : <Send size={16} />} Ask</button></div>
        {err && <div className="error" role="alert"><ShieldAlert size={18} /> {err}</div>}
      </form>
      {[...turns].reverse().map((t, i) => (
        <section className="panel" key={i}><b>{t.q}</b><p style={{ whiteSpace: "pre-wrap" }}>{t.a}</p></section>
      ))}
    </>
  );
}
