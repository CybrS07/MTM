import type { State } from "../shared/types";
import samplePack from "../data/messages.txt?raw";
import { runFull, runUpdate } from "./planner/pipeline";
import { loadState } from "./planner/store";
import { csvSafe } from "./planner/sanitize";

// No server: the planner runs in this browser and calls Gemini directly with the token the user enters.
export const getState = async (): Promise<State | null> => loadState();
export const getSample = async () => ({ text: samplePack });
export const runPlan = (key: string, text: string) => runFull(key, text);
export const sendUpdate = (key: string, text: string) => runUpdate(key, text);

export function downloadCsv(st: State) {
  const rows = [["run", "call", "model", "area", "input_tokens", "output_tokens", "total_tokens", "ms"],
    ...st.runs.flatMap((r) => r.calls.map((c) => [r.id, c.n, c.model, c.area, c.prompt_tokens, c.output_tokens, c.total_tokens, c.ms]))];
  const csv = rows.map((r) => r.map((v) => `"${csvSafe(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "trace.csv"; a.click();
}
