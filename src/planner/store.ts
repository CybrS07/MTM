import type { State } from "../../shared/types";

// The plan lives in this browser (localStorage). Wrapped in try/catch: storage can be blocked or full.
const KEY = "mtm.state", TOKEN = "mtm.gemini";
export const loadState = (): State | null => { try { const t = localStorage.getItem(KEY); return t ? JSON.parse(t) : null; } catch { return null; } };
export const saveState = (s: State) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable: the plan still shows for this visit */ } };
export const loadToken = () => { try { return localStorage.getItem(TOKEN) ?? ""; } catch { return ""; } };
export const saveToken = (t: string) => { try { t ? localStorage.setItem(TOKEN, t) : localStorage.removeItem(TOKEN); } catch { /* ignore */ } };
