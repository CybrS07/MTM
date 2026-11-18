import type { Request, RequestHandler } from "express";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
const sb = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
// REQUIRE_LOGIN=false: no login at all (local use and the hackathon test run). Anything else means login is required.
const off = () => process.env.REQUIRE_LOGIN === "false";

const NOT_CONFIGURED = "Login is on but Supabase is not configured on the server. For local use set REQUIRE_LOGIN=false in .env, or fill SUPABASE_URL and SUPABASE_SECRET_KEY.";

async function who(req: Request) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /i, "");
  if (!token || !sb) return null;
  const { data, error } = await sb.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

/** Any signed-in (PIN-verified) user. */
export const requireUser: RequestHandler = async (req, res, next) => {
  if (off()) return next();
  if (!sb) return void res.status(503).json({ error: NOT_CONFIGURED });
  if (!(await who(req))) return void res.status(401).json({ error: "Sign in first." });
  next();
};

/** Organizers only: they run and update the plan. */
export const requireOrganizer: RequestHandler = async (req, res, next) => {
  if (off()) return next();
  if (!sb) return void res.status(503).json({ error: NOT_CONFIGURED });
  const user = await who(req);
  if (!user) return void res.status(401).json({ error: "Sign in first." });
  const { data } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (data?.role !== "organizer") return void res.status(403).json({ error: "Only organizers can run or update the plan." });
  next();
};
