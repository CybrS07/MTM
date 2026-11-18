import path from "node:path";
// Planner policy: our own design decisions, not facts from the pack.
export const POLICY = { openingMin: 15, lunchMin: 30, closingMin: 15, defaultStart: "09:00" };
const data = path.join(process.cwd(), "data");
export const PATHS = {
  pack: path.join(data, "messages.txt"),
  update: path.join(data, "update.txt"),
  state: path.join(data, "state.json"),
};
