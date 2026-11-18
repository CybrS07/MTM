export type Area = "reading" | "venue" | "schedule" | "food" | "judging" | "budget";
export interface Hall { name: string; seats: number; price: number; generator: boolean }
export interface Money { item: string; amount: number }

export interface Facts {
  event: {
    hours: number; students: number; team_size: number; budget: number; staff: number;
    prayer_break_min: number | null; start_time: string | null; needs_generator: boolean;
  };
  halls: Hall[];
  meal: { standard_price: number | null; basic_price: number | null };
  judging: { confirmed: number; honorarium: number; minutes_per_team: number; max_teams_per_judge: number };
  committed: Money[];
  requests: Money[];
  constraints: string[];
  order_quantity: number | null;
  ignored: { msg: number; reason: string }[];
}

export interface Block { label: string; start: string; end: string; minutes: number; kind: string }

export interface Plan {
  teams: number; people: number;
  venue: { hall: Hall | null; why: string };
  schedule: Block[];
  food: { tier: "standard" | "basic" | "none"; price: number; boxes: number; cost: number };
  judging: {
    judges: number; confirmed: number; rounds: number; minutes: number;
    honorarium: number; total: number; perJudge: { judge: number; teams: number[] }[];
  };
  budget: { lines: Money[]; total: number; limit: number; remaining: number };
  deferred: { item: string; amount: number; note: string }[];
}

export interface Check { id: string; label: string; pass: boolean; detail: string }

export interface Call {
  n: number; model: string; area: Area; input: string; output: string;
  prompt_tokens: number; output_tokens: number; total_tokens: number; ms: number;
}
export interface Step { area: Area; level: "info" | "ok" | "reject"; note: string }

export interface RunTrace {
  id: number; kind: "full" | "update"; message: string; calls: Call[]; steps: Step[];
  total_tokens: number; ms: number; at: string; outcome: "applied" | "rejected" | "skipped";
}
export interface Rejected { at: string; message: string; reason: string; source: "model" | "validator" | "skipped" }

export interface State {
  facts: Facts; plan: Plan; checks: Check[]; valid: boolean;
  runs: RunTrace[]; rejected: Rejected[]; updatedAt: string;
}
