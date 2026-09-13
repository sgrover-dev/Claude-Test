import type { FactSource } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { SOURCE_TYPES, labelFor } from "@/lib/taxonomy";
import { ConfidenceBadge } from "@/components/ui";

export function ProvenancePanel({ provenance, lastVerifiedAt, verificationStatus }: { provenance: FactSource[]; lastVerifiedAt: Date | null; verificationStatus: string }) {
  const grouped = new Map<string, FactSource[]>();
  for (const p of provenance) {
    const key = `${p.sourceType}|${p.sourceUrl ?? ""}|${p.confidence}`;
    grouped.set(key, [...(grouped.get(key) ?? []), p]);
  }
  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[16px] font-semibold text-ink-900">Where this information comes from</h2>
        <span className="text-[13px] text-ink-500">
          {verificationStatus === "verified" ? `Verified by Red Rope ${lastVerifiedAt ? formatDate(lastVerifiedAt) : ""}` : verificationStatus === "publicly_listed" ? "From the restaurant's public materials" : "Not yet verified with the restaurant"}
        </span>
      </div>
      <p className="mt-1 text-[13.5px] text-ink-600">We label every fact so you know what's confirmed and what's an estimate. Anything uncertain gets checked directly with the restaurant before you commit.</p>
      {grouped.size ? (
        <ul className="mt-3 space-y-2">
          {Array.from(grouped.values()).map((rows) => {
            const p = rows[0];
            const fields = rows.map((r) => r.field).filter(Boolean) as string[];
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-2 text-[13.5px] text-ink-700">
                <ConfidenceBadge confidence={p.confidence} compact />
                <span>{labelFor(SOURCE_TYPES, p.sourceType)}</span>
                {p.sourceUrl ? (
                  <a href={p.sourceUrl} target="_blank" rel="noreferrer nofollow" className="text-rope-700 underline-offset-2 hover:underline">
                    source
                  </a>
                ) : null}
                {fields.length ? <span className="text-ink-500">({fields.map(humanField).join(", ")})</span> : null}
                {p.note ? <span className="text-ink-500">— {p.note}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function humanField(f: string) {
  return f.replace(/Cents$/, "").replace(/([A-Z])/g, " $1").toLowerCase().replace(/^est /, "est. ").replace(/fb /, "F&B ").trim();
}
