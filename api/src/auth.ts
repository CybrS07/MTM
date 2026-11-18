import type { Request, RequestHandler } from "express";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
const sb = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
const off = () => process.env.REQUIRE_LOGIN === "false"; // local tests only

async function who(req: Request) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /i, "");
  if (!token || !sb) return null;
  const { data, error } = await sb.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

/** Any signed-in (PIN-verified) user. */
export const requireUser: RequestHandler = async (req, res, next) => {
  if (off()) return next();
  if (!(await who(req))) return void res.status(401).json({ error: "Sign in first." });
  next();
};

/** Organizers only: they run and update the plan. */
export const requireOrganizer: RequestHandler = async (req, res, next) => {
  if (off()) return next();
  const user = await who(req);
  if (!user) return void res.status(401).json({ error: "Sign in first." });
  const { data } = await sb!.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (data?.role !== "organizer") return void res.status(403).json({ error: "Only organizers can run or update the plan." });
  next();
};
