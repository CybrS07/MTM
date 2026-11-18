import { Building2, CalendarClock, CheckCircle2, Gavel, ShieldAlert, Utensils, Wallet } from "lucide-react";
import type { State } from "../../shared/types";

const rs = (n: number) => "Rs " + Math.round(n).toLocaleString("en-US");

export default function PlanView({ st }: { st: State }) {
  const p = st.plan;
  return (
    <>
      <div className="checks" role="list">
        {st.checks.map((c) => (
          <div key={c.id} role="listitem" className={`check ${c.pass ? "pass" : "fail"}`}>
            {c.pass ? <CheckCircle2 size={20} /> : <ShieldAlert size={20} />}
            <div><b>{c.label}</b><span>{c.detail}</span></div>
          </div>
        ))}
      </div>

      <div className="grid">
        <section className="panel card">
          <h2><Building2 size={18} /> Venue</h2>
          <div className="big">{p.venue.hall?.name ?? "No hall fits"}</div>
          <p className="muted">{p.venue.why}</p>
        </section>

        <section className="panel card">
          <h2><Utensils size={18} /> Food</h2>
          <div className="big">{rs(p.food.cost)}</div>
          <p className="muted">{p.food.boxes} {p.food.tier} lunch boxes at {rs(p.food.price)}. Covers {st.facts.event.students} students, {st.facts.event.staff} staff and {p.judging.judges} judges.</p>
        </section>

        <section className="panel card">
          <h2><CalendarClock size={18} /> Schedule</h2>
          <ul className="tl">
            {p.schedule.map((b) => (
              <li key={b.label} className={b.kind}>
                <span className="t">{b.start}–{b.end}</span><span>{b.label}</span><span className="muted">{b.minutes} min</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel card">
          <h2><Gavel size={18} /> Judging</h2>
          <div className="big">{p.judging.judges} judges · {p.teams} teams</div>
          <p className="muted">{p.judging.rounds} rounds of {st.facts.judging.minutes_per_team} min. Honoraria {rs(p.judging.total)}.</p>
          <div className="scroll">
            <table>
              <thead><tr><th>Judge</th><th>Teams</th></tr></thead>
              <tbody>{p.judging.perJudge.map((j) => <tr key={j.judge}><td>{j.judge}</td><td>{j.teams.join(", ")}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="panel card" style={{ gridColumn: "1 / -1" }}>
          <h2><Wallet size={18} /> Budget</h2>
          <table>
            <tbody>
              {p.budget.lines.map((l, i) => <tr key={i}><td>{l.item}</td><td className="num">{rs(l.amount)}</td></tr>)}
              <tr><th>Total</th><th className="num">{rs(p.budget.total)}</th></tr>
              <tr><td className="muted">Limit {rs(p.budget.limit)}</td><td className="num"><b>{rs(p.budget.remaining)} left</b></td></tr>
            </tbody>
          </table>
          {p.deferred.map((d) => (
            <p key={d.item} className="muted">Not included: {d.item} ({rs(d.amount)}). {d.note}</p>
          ))}
        </section>
      </div>
    </>
  );
}
