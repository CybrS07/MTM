import { createClient } from "@supabase/supabase-js";

// Public values only. The secret key never goes in the browser.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
  { auth: { persistSession: true, autoRefreshToken: true } },
);

/** Readable message from an Edge Function error. */
export async function fnMessage(e: unknown): Promise<string> {
  const ctx = (e as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try { return (await ctx.json()).error ?? "Request failed."; } catch { /* fall through */ }
  }
  return (e as Error)?.message ?? "Request failed.";
}
