import { useState } from "react";
import { Bot, KeyRound, Loader2, Mail, ShieldAlert } from "lucide-react";
import { fnMessage, supabase } from "../lib/supabase";

export default function Login() {
  const [step, setStep] = useState<"email" | "pin">("email");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const { error } = await supabase.functions.invoke("send-pin", { body: { email } });
    if (error) setErr(await fnMessage(error)); else setStep("pin");
    setBusy(false);
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const { data, error } = await supabase.functions.invoke("verify-pin", { body: { email, pin } });
    if (error) { setErr(await fnMessage(error)); setBusy(false); return; }
    const { error: e2 } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: "magiclink" });
    if (e2) setErr("Could not sign you in. Request a new code.");
    setBusy(false);
  };

  return (
    <main className="login">
      <form className="panel" onSubmit={step === "email" ? sendCode : verify}>
        <span className="logo"><Bot size={22} /></span>
        <h1>Sign in</h1>
        {step === "email" ? (
          <>
            <p className="muted">We email you a 6-digit code.</p>
            <label className="field"><Mail size={16} />
              <input type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button className="btn primary" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Mail size={16} />} Send code</button>
          </>
        ) : (
          <>
            <p className="muted">Enter the code sent to {email}. It expires in 10 minutes.</p>
            <label className="field"><KeyRound size={16} />
              <input inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="one-time-code" placeholder="123456" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
            </label>
            <div className="row">
              <button className="btn primary" disabled={busy || pin.length !== 6}>{busy ? <Loader2 size={16} className="spin" /> : <KeyRound size={16} />} Verify</button>
              <button type="button" className="btn" onClick={() => { setStep("email"); setPin(""); setErr(""); }}>Change email</button>
            </div>
          </>
        )}
        {err && <div className="error" role="alert"><ShieldAlert size={18} /> {err}</div>}
      </form>
    </main>
  );
}
