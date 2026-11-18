import { createClient } from "@supabase/supabase-js";

// Public values only. The secret key never goes in the browser.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim();

/**
 * False when the two public Supabase values are missing from .env (or from the GitHub Pages build variables).
 * createClient() throws on an empty URL, and a throw at import time is what produced the blank white page.
 * Now the app starts in no-login mode instead.
 */
export const SUPABASE_ON = Boolean(url && key && /^https?:\/\//.test(url));

// When Supabase is off this is an inert placeholder client. App.tsx never calls it in no-login mode.
export const supabase = createClient(
  SUPABASE_ON ? url! : "http://localhost:54321",
  SUPABASE_ON ? key! : "supabase-not-configured",
  { auth: { persistSession: SUPABASE_ON, autoRefreshToken: SUPABASE_ON } },
);

/** Readable message from an Edge Function error. */
export async function fnMessage(e: unknown): Promise<string> {
  const ctx = (e as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try { return (await ctx.json()).error ?? "Request failed."; } catch { /* fall through */ }
  }
  return (e as Error)?.message ?? "Request failed.";
}
