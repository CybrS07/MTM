import type { State } from "../shared/types";
import { supabase } from "./lib/supabase";

/** Empty in dev (the Vite proxy handles /api). On GitHub Pages, set the VITE_API_URL variable to your API's https address. */
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/$/, "");

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API_BASE + path, { ...init, headers: { "Content-Type": "application/json", ...(await authHeaders()) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
  return body as T;
}
export const getState = () => req<State | null>("/api/state");
export const getSample = () => req<{ text: string }>("/api/sample");
export const runPlan = (text: string) => req<State>("/api/run", { method: "POST", body: JSON.stringify({ text }) });
export const sendUpdate = (text: string) => req<State>("/api/update", { method: "POST", body: JSON.stringify({ text }) });

export async function downloadCsv() {
  const r = await fetch(API_BASE + "/api/export.csv", { headers: await authHeaders() });
  if (!r.ok) throw new Error("Could not download the table.");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await r.blob());
  a.download = "trace.csv"; a.click();
}
