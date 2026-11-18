import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import http from "node:http";
import https from "node:https";
import { PATHS } from "./config.js";
import { loadTls } from "./ssl.js";
import { loadState, readText, writeText } from "./store.js";
import { runFull, runUpdate } from "./pipeline.js";

const HTTPS_PORT = Number(process.env.HTTPS_PORT || 8443);
const HTTP_PORT = Number(process.env.HTTP_PORT || 8080);
const app = express();

app.disable("x-powered-by");
app.use(helmet({ hsts: { maxAge: 63072000, includeSubDomains: true, preload: true } })); // HSTS: browsers stay on HTTPS
app.use(cors({ origin: process.env.WEB_ORIGIN || "https://localhost:5173" }));
app.use(express.json({ limit: "200kb" }));
app.use((req, res, next) => (req.secure ? next() : res.status(426).json({ error: "HTTPS required" })));

const wrap = (fn: express.RequestHandler): express.RequestHandler => async (req, res, next) => {
  try { await fn(req, res, next); } catch (e) { console.error(e); res.status(500).json({ error: (e as Error).message }); }
};

app.get("/api/health", (_q, r) => r.json({ ok: true }));
app.get("/api/state", (_q, r) => r.json(loadState()));
app.get("/api/sample", (_q, r) => r.json({ text: readText(PATHS.pack) }));
app.get("/api/export", (_q, r) => { r.setHeader("Content-Disposition", "attachment; filename=plan-and-trace.json"); r.json(loadState()); });

app.post("/api/run", wrap(async (req, res) => {
  if (typeof req.body?.text === "string" && req.body.text.trim()) writeText(PATHS.pack, req.body.text);
  res.json(await runFull());
}));
app.post("/api/update", wrap(async (req, res) => {
  const text = String(req.body?.text ?? "").trim();
  if (!text) return void res.status(400).json({ error: "Message is empty." });
  writeText(PATHS.update, text);
  res.json(await runUpdate());
}));

https.createServer({ ...loadTls(), minVersion: "TLSv1.2" }, app).listen(HTTPS_PORT, () => console.log(`API  https://localhost:${HTTPS_PORT}`));
http.createServer((req, res) => {
  const host = (req.headers.host || "localhost").replace(/:\d+$/, "");
  res.writeHead(301, { Location: `https://${host}:${HTTPS_PORT}${req.url}` }).end();
}).listen(HTTP_PORT, () => console.log(`HTTP http://localhost:${HTTP_PORT} redirects to HTTPS`));
