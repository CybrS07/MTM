import { spawn } from "node:child_process";
import { cleanDeep } from "./sanitize.js";

export interface AIResult {
  parsed: any;
  call: { model: string; input: string; output: string; prompt_tokens: number; output_tokens: number; total_tokens: number; ms: number };
}

const KINDS = new Set(["change", "wrong", "irrelevant"]);
const PY = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");

// Preferred: `uv run` (uses pyproject.toml and uv.lock). Fallback: plain python, since reader.py only needs the standard library.
// Set PYTHON_BIN to skip uv and use that interpreter directly.
const launchers: [string, string[]][] = process.env.PYTHON_BIN
  ? [[PY, ["ai/reader.py"]]]
  : [["uv", ["run", "--quiet", "ai/reader.py"]], [PY, ["ai/reader.py"]]];

function spawnOnce(cmd: string, args: string[], payload: object): Promise<string> {
  return new Promise((resolve, reject) => {
    // shell:false and JSON on stdin: nothing from a message ever reaches a command line.
    const py = spawn(cmd, args, { env: { ...process.env, PYTHONIOENCODING: "utf-8" }, shell: false });
    let out = "", err = "";
    py.stdout.on("data", (d) => (out += d));
    py.stderr.on("data", (d) => (err += d));
    py.on("error", (e: NodeJS.ErrnoException) => reject(Object.assign(new Error(`Cannot start ${cmd}: ${e.message}`), { missing: e.code === "ENOENT" })));
    py.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err.trim() || `${cmd} exited with ${code}`))));
    py.stdin.end(JSON.stringify(payload));
  });
}

/** Runs ai/reader.py, the only code that talks to Gemini. */
export async function callAI(payload: { mode: "read" | "update"; text: string; facts?: unknown }): Promise<AIResult> {
  let out = "";
  for (let i = 0; i < launchers.length; i++) {
    try { out = await spawnOnce(launchers[i][0], launchers[i][1], payload); break; }
    catch (e) { if (!(e as any).missing || i === launchers.length - 1) throw e; } // uv not installed: try python
  }
  try {
    const r: AIResult = JSON.parse(out);
    r.parsed = cleanDeep(r.parsed); // model output is untrusted: strip tags and control characters
    if (payload.mode === "update" && !KINDS.has(r.parsed?.kind)) throw new Error("Model returned an unknown message type.");
    return r;
  } catch (e) { throw new Error("AI returned invalid output: " + (e as Error).message); }
}
