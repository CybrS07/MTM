import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import http from "node:http";
import https from "node:https";
import { PATHS } from "./config.js";
import { loadTls } from "./ssl.js";
import { loadState, readText, writeText } from "./store.js";
import { runFull, runUpdate } from "./pipeline.js";
import { HttpError, bodyText, csvSafe } from "./sanitize.js";
import { requireOrganizer, requireUser } from "./auth.js";

const HTTPS_PORT = Number(process.env.HTTPS_PORT || 8443);
const HTTP_PORT = Number(process.env.HTTP_PORT || 8080);
const BEHIND_PROXY = process.env.BEHIND_PROXY === "true"; // host terminates TLS and forwards plain HTTP to PORT
const app = express();
if (BEHIND_PROXY) app.set("trust proxy", 1);

app.disable("x-powered-by");
app.use(helmet({
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },       // browsers stay on HTTPS
  contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] } }, // XSS: API never serves runnable content
  referrerPolicy: { policy: "no-referrer" },
  crossOriginResourcePolicy: { policy: "same-site" },
}));
app.use((_q, r, next) => { r.setHeader("Cache-Control", "no-store"); r.setHeader("X-Content-Type-Options", "nosniff"); next(); });
app.use(cors({ origin: process.env.WEB_ORIGIN || "https://localhost:5173", methods: ["GET", "POST"] }));
app.use(express.json({ limit: "50kb", type: "application/json" }));        // JSON only, small bodies
app.get("/api/health", (_q, r) => r.json({ ok: true }));                    // before the HTTPS check so host health checks pass
app.use((req, res, next) => (req.secure ? next() : res.status(426).json({ error: "HTTPS required" })));

// Rate limits: general traffic, and a tight limit on the routes that spend model tokens.
const tooMany = { error: "Too many requests. Wait a minute and try again." };
app.use("/api", rateLimit({ windowMs: 60_000, limit: Number(process.env.RATE_GENERAL_PER_MIN || 120), standardHeaders: "draft-7", legacyHeaders: false, message: tooMany }));
const heavy = rateLimit({ windowMs: 60_000, limit: Number(process.env.RATE_HEAVY_PER_MIN || 10), standardHeaders: "draft-7", legacyHeaders: false, message: tooMany });

// One model job at a time, so two requests can never corrupt the saved plan.
let busy = false;
const job = (fn: (req: express.Request, res: express.Response) => Promise<void>): express.RequestHandler => async (req, res) => {
  if (busy) return void res.status(429).json({ error: "A plan is already being built. Wait for it to finish." });
  busy = true;
  try { await fn(req, res); }
  catch (e) {
    if (e instanceof HttpError) return void res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: "The planner failed. Check the server log." });
  } finally { busy = false; }
};

app.get("/api/state", requireUser, (_q, r) => r.json(loadState()));
app.get("/api/sample", requireUser, (_q, r) => r.json({ text: readText(PATHS.pack) }));
app.get("/api/export", requireUser, (_q, r) => { r.setHeader("Content-Disposition", "attachment; filename=plan-and-trace.json"); r.json(loadState()); });

app.get("/api/export.csv", requireUser, (_q, res) => {
  const st = loadState();
  const rows = [["run", "call", "model", "area", "input_tokens", "output_tokens", "total_tokens", "ms"],
    ...(st?.runs ?? []).flatMap((r) => r.calls.map((c) => [r.id, c.n, c.model, c.area, c.prompt_tokens, c.output_tokens, c.total_tokens, c.ms]))];
  res.type("text/csv").setHeader("Content-Disposition", "attachment; filename=trace.csv");
  res.send(rows.map((r) => r.map((v) => `"${csvSafe(v).replace(/"/g, '""')}"`).join(",")).join("\n"));
});

app.post("/api/run", heavy, requireOrganizer, job(async (req, res) => {
  if (req.body?.text !== undefined) writeText(PATHS.pack, bodyText(req.body.text));
  res.json(await runFull());
}));
app.post("/api/update", heavy, requireOrganizer, job(async (req, res) => {
  writeText(PATHS.update, bodyText(req.body?.text, 5000));
  res.json(await runUpdate());
}));

// Unknown routes and malformed JSON never leak stack traces.
app.use((_q, r) => r.status(404).json({ error: "Not found" }));
app.use((err: any, _q: express.Request, r: express.Response, _n: express.NextFunction) =>
  r.status(err?.status === 413 ? 413 : 400).json({ error: err?.status === 413 ? "Request too large." : "Bad request." }));

if (BEHIND_PROXY) {
  const port = Number(process.env.PORT || 10000);
  http.createServer(app).listen(port, () => console.log(`API behind HTTPS proxy on port ${port}`));
} else {
  https.createServer({ ...loadTls(), minVersion: "TLSv1.2" }, app).listen(HTTPS_PORT, () => console.log(`API  https://localhost:${HTTPS_PORT}`));
  http.createServer((req, res) => {
    const host = (req.headers.host || "localhost").replace(/[^a-zA-Z0-9.\-]/g, "").replace(/:\d+$/, "");
    res.writeHead(301, { Location: `https://${host}:${HTTPS_PORT}${encodeURI(req.url || "/")}` }).end();
  }).listen(HTTP_PORT, () => console.log(`HTTP http://localhost:${HTTP_PORT} redirects to HTTPS`));
}
