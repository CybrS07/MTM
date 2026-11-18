import { spawn } from "node:child_process";
import { cleanDeep } from "./sanitize.js";

export interface AIResult {
  parsed: any;
  call: { model: string; input: string; output: string; prompt_tokens: number; output_tokens: number; total_tokens: number; ms: number };
}

const PY = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
const KINDS = new Set(["change", "wrong", "irrelevant"]);

/** Runs ai/reader.py, the only code that talks to Gemini. Arguments are passed as JSON on stdin, never on a shell line. */
export function callAI(payload: { mode: "read" | "update"; text: string; facts?: unknown }): Promise<AIResult> {
  return new Promise((resolve, reject) => {
    const py = spawn(PY, ["ai/reader.py"], { env: { ...process.env, PYTHONIOENCODING: "utf-8" }, shell: false });
    let out = "", err = "";
    py.stdout.on("data", (d) => (out += d));
    py.stderr.on("data", (d) => (err += d));
    py.on("error", (e) => reject(new Error(`Cannot start Python (${PY}): ${e.message}`)));
    py.on("close", (code) => {
      if (code !== 0) return reject(new Error(err.trim() || `Python exited with ${code}`));
      try {
        const r: AIResult = JSON.parse(out);
        r.parsed = cleanDeep(r.parsed); // model output is untrusted: strip tags and control characters
        if (payload.mode === "update" && !KINDS.has(r.parsed?.kind)) throw new Error("Model returned an unknown message type.");
        resolve(r);
      } catch (e) { reject(new Error("AI returned invalid output: " + (e as Error).message)); }
    });
    py.stdin.end(JSON.stringify(payload));
  });
}
