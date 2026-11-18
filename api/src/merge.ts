import type { Facts } from "../../shared/types";

const upsert = (base: any[], patch: any[] | undefined, key: string) => {
  for (const p of patch ?? []) {
    const i = base.findIndex((b) => String(b[key]).toLowerCase() === String(p[key]).toLowerCase());
    if (i >= 0) base[i] = { ...base[i], ...p }; else base.push(p);
  }
};

/** Fill gaps so a sloppy model reply cannot crash the planner. */
export function normalize(x: any): Facts {
  const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const nn = (v: any) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  const e = x?.event ?? {}, m = x?.meal ?? {}, j = x?.judging ?? {};
  return {
    event: {
      hours: n(e.hours), students: n(e.students), team_size: n(e.team_size), budget: n(e.budget), staff: n(e.staff),
      prayer_break_min: nn(e.prayer_break_min), start_time: e.start_time ?? null, needs_generator: !!e.needs_generator,
    },
    halls: (x?.halls ?? []).map((h: any) => ({ name: String(h.name), seats: n(h.seats), price: n(h.price), generator: !!h.generator })),
    meal: { standard_price: nn(m.standard_price), basic_price: nn(m.basic_price) },
    judging: { confirmed: n(j.confirmed), honorarium: n(j.honorarium), minutes_per_team: n(j.minutes_per_team), max_teams_per_judge: n(j.max_teams_per_judge) },
    committed: (x?.committed ?? []).map((c: any) => ({ item: String(c.item), amount: n(c.amount) })),
    requests: (x?.requests ?? []).map((c: any) => ({ item: String(c.item), amount: n(c.amount) })),
    constraints: (x?.constraints ?? []).map(String),
    order_quantity: nn(x?.order_quantity),
    ignored: (x?.ignored ?? []).map((i: any) => ({ msg: n(i.msg), reason: String(i.reason) })),
  };
}

export function mergeFacts(base: Facts, patch: any): Facts {
  const out: Facts = structuredClone(base);
  for (const k of ["event", "meal", "judging"] as const)
    for (const [kk, v] of Object.entries(patch?.[k] ?? {}))
      if (v !== null && v !== undefined) (out[k] as any)[kk] = v;
  upsert(out.halls, patch?.halls, "name");
  upsert(out.committed, patch?.committed, "item");
  upsert(out.requests, patch?.requests, "item");
  if (patch?.constraints) out.constraints = [...new Set([...out.constraints, ...patch.constraints.map(String)])];
  if (patch?.order_quantity != null) out.order_quantity = Number(patch.order_quantity);
  return normalize(out);
}
