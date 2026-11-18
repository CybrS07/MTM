import { Ban } from "lucide-react";
import type { State } from "../../shared/types";

const label = { model: "Rejected by the model", validator: "Rejected by the plan checks", skipped: "Skipped" } as const;

export default function RejectedView({ st }: { st: State }) {
  if (!st.rejected.length) return <p className="empty">Nothing rejected yet. Wrong, outdated and irrelevant messages show up here with the reason.</p>;
  return (
    <>
      {st.rejected.map((r, i) => (
        <section key={i} className="panel reject-card">
          <h2><Ban size={18} /> {label[r.source]}</h2>
          <blockquote>{r.message}</blockquote>
          <p>{r.reason}</p>
        </section>
      ))}
    </>
  );
}
