import "dotenv/config";
import { runFull, runUpdate } from "./pipeline.js";
import type { State } from "../../shared/types";

const cmd = process.argv[2];
const st: State = cmd === "update" ? await runUpdate() : await runFull();
const run = st.runs[st.runs.length - 1];

console.log(`\n=== TRACE · run ${run.id} (${run.kind}) · ${run.outcome} · ${run.ms} ms ===`);
for (const c of run.calls) {
  console.log(`\n[call ${c.n}] model=${c.model} area=${c.area}`);
  console.log(`  tokens: input ${c.prompt_tokens} · output ${c.output_tokens} · total ${c.total_tokens}`);
  console.log(`  INPUT:\n${c.input}\n  OUTPUT:\n${c.output}`);
}
console.log("\n--- steps ---");
for (const s of run.steps) console.log(`  [${s.area}] ${s.level === "reject" ? "✗" : s.level === "ok" ? "✓" : "·"} ${s.note}`);
console.log("\n--- plan checks ---");
for (const c of st.checks) console.log(`  ${c.pass ? "PASS" : "FAIL"}  ${c.label}: ${c.detail}`);
console.log(`\nTOTAL TOKENS: ${run.total_tokens}`);
