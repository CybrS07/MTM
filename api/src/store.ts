import fs from "node:fs";
import path from "node:path";
import type { State } from "../../shared/types";
import { PATHS } from "./config.js";

export const readText = (p: string) => fs.readFileSync(p, "utf-8");
export const writeText = (p: string, t: string) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, t, "utf-8"); };
export const loadState = (): State | null => (fs.existsSync(PATHS.state) ? JSON.parse(readText(PATHS.state)) : null);
export const saveState = (s: State) => writeText(PATHS.state, JSON.stringify(s, null, 2));
