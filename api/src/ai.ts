import { spawn } from "node:child_process";

export interface AIResult {
  parsed: any;
  call: { model: string; input: string; output: string; prompt_tokens: number; output_tokens: number; total_tokens: number; ms: number };
}

const PY = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");

/** Runs ai/reader.py, the only code that talks to Gemini. */
export function callAI(payload: object): Promise<AIResult> {
  return new Promise((resolve, reject) => {
    const py = spawn(PY, ["ai/reader.py"], { env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
    let out = "", err = "";
    py.stdout.on("data", (d) => (out += d));
    py.stderr.on("data", (d) => (err += d));
    py.on("error", (e) => reject(new Error(`Cannot start Python (${PY}): ${e.message}`)));
    py.on("close", (code) => {
      if (code !== 0) return reject(new Error(err.trim() || `Python exited with ${code}`));
      try { resolve(JSON.parse(out)); } catch { reject(new Error("AI returned invalid JSON: " + out.slice(0, 200))); }
    });
    py.stdin.end(JSON.stringify(payload));
  });
}
