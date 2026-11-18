import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, ShieldAlert, Trash2, Upload } from "lucide-react";
import { supabase } from "../lib/supabase";

const rs = (n: number) => "Rs " + Math.round(n).toLocaleString("en-US");
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
interface Receipt { id: string; user_id: string; path: string; amount_rs: number; note: string | null; created_at: string }

export default function Receipts({ userId, organizer }: { userId: string; organizer: boolean }) {
  const [list, setList] = useState<Receipt[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("receipts").select("*").order("created_at", { ascending: false }).limit(100);
    setList((data as Receipt[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    if (!file) return setErr("Choose a file.");
    const ext = TYPES[file.type];
    if (!ext) return setErr("Use a JPG, PNG, WebP or PDF file.");
    if (file.size > 5 * 1024 * 1024) return setErr("The file is over 5 MB.");
    const rupees = Math.round(Number(amount));
    if (!Number.isFinite(rupees) || rupees < 0) return setErr("Enter the amount in rupees.");
    setBusy(true);
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("receipts").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { setErr(up.error.message); setBusy(false); return; }
    const ins = await supabase.from("receipts").insert({ path, amount_rs: rupees, note: note.trim().slice(0, 300) || null });
    if (ins.error) { await supabase.storage.from("receipts").remove([path]); setErr(ins.error.message); }
    else { setFile(null); setAmount(""); setNote(""); (e.target as HTMLFormElement).reset(); await load(); }
    setBusy(false);
  };

  const open = async (path: string) => {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  const remove = async (r: Receipt) => {
    await supabase.storage.from("receipts").remove([r.path]);
    await supabase.from("receipts").delete().eq("id", r.id);
    await load();
  };

  const total = list.reduce((s, r) => s + r.amount_rs, 0);
  return (
    <>
      <form className="panel" onSubmit={upload}>
        <h2><Upload size={18} /> Add a receipt</h2>
        <div className="form-grid">
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Receipt file" />
          <input type="number" min={0} placeholder="Amount (Rs)" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount in rupees" />
          <input maxLength={300} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
        </div>
        <div className="row"><button className="btn primary" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Upload size={16} />} Upload</button></div>
        {err && <div className="error" role="alert"><ShieldAlert size={18} /> {err}</div>}
      </form>
      <section className="panel">
        <h2>{organizer ? "All receipts" : "Your receipts"} · {rs(total)}</h2>
        {list.length === 0 ? <p className="muted">No receipts yet.</p> : (
          <div className="scroll"><table>
            <thead><tr><th>Date</th><th>Note</th><th className="num">Amount</th><th /></tr></thead>
            <tbody>{list.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleDateString()}</td><td>{r.note ?? ""}</td><td className="num">{rs(r.amount_rs)}</td>
                <td className="actions">
                  <button className="btn icon-btn" aria-label="Open receipt" onClick={() => open(r.path)}><ExternalLink size={16} /></button>
                  {r.user_id === userId && <button className="btn icon-btn" aria-label="Delete receipt" onClick={() => remove(r)}><Trash2 size={16} /></button>}
                </td>
              </tr>))}</tbody>
          </table></div>)}
      </section>
    </>
  );
}
