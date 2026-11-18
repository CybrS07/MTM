import type { State } from "../shared/types";

/** Empty in dev (the Vite proxy handles /api). On GitHub Pages, set the VITE_API_URL variable to your API's https address. */
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/$/, "");

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API_BASE + path, { headers: { "Content-Type": "application/json" }, ...init });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
  return body as T;
}
export const getState = () => req<State | null>("/api/state");
export const getSample = () => req<{ text: string }>("/api/sample");
export const runPlan = (text: string) => req<State>("/api/run", { method: "POST", body: JSON.stringify({ text }) });
export const sendUpdate = (text: string) => req<State>("/api/update", { method: "POST", body: JSON.stringify({ text }) });
