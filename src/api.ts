import type { State } from "../shared/types";
import { SUPABASE_ON, supabase } from "./lib/supabase";

/** Empty in dev (the Vite proxy handles /api). On GitHub Pages, set the VITE_API_URL variable to your API's https address. */
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/$/, "");

export const API_DOWN = "Cannot reach the planner API. Start everything with `npm run dev` (local), or set VITE_API_URL to your API address (deployed site).";

async function authHeaders(): Promise<Record<string, string>> {
  if (!SUPABASE_ON) return {}; // no-login mode: the API runs with REQUIRE_LOGIN=false
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try { r = await fetch(API_BASE + path, { ...init, headers: { "Content-Type": "application/json", ...(await authHeaders()) } }); }
  catch { throw new Error(API_DOWN); }
  // A reply that is not JSON did not come from our API (a static host or the dev server answered instead).
  if (!(r.headers.get("content-type") ?? "").includes("application/json")) {
    throw new Error(`${API_DOWN} (${r.status} came from ${API_BASE || location.origin}, not from the API)`);
  }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
  return body as T;
}
export const getState = () => req<State | null>("/api/state");
export const getSample = () => req<{ text: string }>("/api/sample");
export const runPlan = (text: string) => req<State>("/api/run", { method: "POST", body: JSON.stringify({ text }) });
export const sendUpdate = (text: string) => req<State>("/api/update", { method: "POST", body: JSON.stringify({ text }) });

export async function downloadCsv() {
  const r = await fetch(API_BASE + "/api/export.csv", { headers: await authHeaders() }).catch(() => null);
  if (!r || !r.ok) throw new Error("Could not download the table.");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await r.blob());
  a.download = "trace.csv"; a.click();
}
