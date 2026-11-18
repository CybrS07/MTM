// Checks that this machine can run the planner. Prints what is missing and how to fix it. Needs only Node.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
let bad = 0;
const ok = (m) => console.log(`  OK    ${m}`);
const no = (m, fix) => { bad++; console.log(`  FAIL  ${m}\n        fix: ${fix}`); };
const warn = (m) => console.log(`  NOTE  ${m}`);

console.log("\nPlanner setup check\n");

const major = Number(process.versions.node.split(".")[0]);
major >= 20 ? ok(`Node ${process.versions.node}`) : no(`Node ${process.versions.node} is too old`, "install Node 20 or newer from nodejs.org");

const py = ["python", "python3", "py"].map((c) => [c, spawnSync(c, ["--version"], { encoding: "utf-8" })]).find(([, r]) => r.status === 0);
py ? ok(`Python: ${(py[1].stdout || py[1].stderr).trim()} (command "${py[0]}")`) : no("Python 3.9+ not found on PATH", "install Python from python.org and tick 'Add to PATH'");

// every package in package.json must exist in node_modules
const wanted = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
const missing = wanted.filter((n) => !fs.existsSync(path.join(root, "node_modules", ...n.split("/"), "package.json")));
if (missing.length) no(`${missing.length} package(s) not installed: ${missing.join(", ")}`, "run: npm install");
else ok(`all ${wanted.length} npm packages are installed`);

// .env
const envPath = path.join(root, ".env");
if (!fs.existsSync(envPath)) no(".env file not found", "copy .env.example to .env and add your GEMINI_API_KEY");
else {
  ok(".env found");
  const env = Object.fromEntries(fs.readFileSync(envPath, "utf-8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  env.GEMINI_API_KEY ? ok("GEMINI_API_KEY is set") : no("GEMINI_API_KEY is empty", "get a free key at https://aistudio.google.com/apikey and put it in .env");
  if (env.REQUIRE_LOGIN !== "false") warn("REQUIRE_LOGIN is not false: the API will ask for a login. For local use set REQUIRE_LOGIN=false.");
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) warn("VITE_SUPABASE_* not set: the web app opens in no-login mode (this is fine locally).");
  else if (env.REQUIRE_LOGIN === "false") warn("Supabase keys are set but REQUIRE_LOGIN=false: the web app will show a login the API does not need.");
}

for (const f of ["data/messages.txt"]) fs.existsSync(path.join(root, f)) ? ok(`${f} found`) : no(`${f} missing`, "restore it from git");

console.log(bad ? `\n${bad} problem(s). Fix them and run: npm run doctor\n` : "\nAll good. Run: npm run dev   (web app + API)   or   npm run plan   (terminal trace)\n");
process.exit(bad ? 1 : 0);
