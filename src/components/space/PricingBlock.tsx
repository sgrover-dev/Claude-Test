import type { FactSource, Space } from "@/db/schema";
import { estimateSpend } from "@/lib/search/estimate";
import { formatCents } from "@/lib/format";
import { ConfidenceBadge } from "@/components/ui";

type PricingSpace = Pick<Space, "fbMinimumCents" | "roomFeeCents" | "estPerPersonLowCents" | "estPerPersonHighCents" | "serviceChargePct" | "adminFeePct" | "taxPct" | "depositCents" | "depositNotes" | "cancellationPolicy" | "pricingNotes" | "daypartMinimums">;

/** Returns the best-known confidence for a pricing field from provenance rows. */
export function fieldConfidence(provenance: FactSource[], field: string, fallback: string = "unknown"): string {
  const rank = { verified: 3, publicly_listed: 2, estimate: 1, unknown: 0 } as const;
  let best: string | null = null;
  for (const p of provenance) {
    if (p.field && p.field !== field) continue;
    if (!best || rank[p.confidence] > rank[best as keyof typeof rank]) best = p.confidence;
  }
  return best ?? fallback;
}

export function PricingBlock({ space, provenance, guests, taxDefault }: { space: PricingSpace; provenance: FactSource[]; guests?: number; taxDefault: number }) {
  const est = estimateSpend({ ...space, serviceChargePct: space.serviceChargePct, taxPct: space.taxPct }, guests, taxDefault);
  const rows: { label: string; value: string; field: string }[] = [];
  if (space.fbMinimumCents != null) rows.push({ label: "Food & beverage minimum", value: formatCents(space.fbMinimumCents), field: "fbMinimumCents" });
  if (space.roomFeeCents != null) rows.push({ label: "Room fee", value: formatCents(space.roomFeeCents), field: "roomFeeCents" });
  if (space.estPerPersonLowCents != null)
    rows.push({ label: "Per person", value: space.estPerPersonHighCents && space.estPerPersonHighCents !== space.estPerPersonLowCents ? `${formatCents(space.estPerPersonLowCents)}–${formatCents(space.estPerPersonHighCents)}` : formatCents(space.estPerPersonLowCents), field: "estPerPersonLowCents" });
  if (space.depositCents != null) rows.push({ label: "Deposit", value: formatCents(space.depositCents), field: "depositCents" });
  if (space.serviceChargePct != null) rows.push({ label: "Service charge", value: `${Number(space.serviceChargePct)}%`, field: "serviceChargePct" });
  if (space.adminFeePct != null) rows.push({ label: "Admin fee", value: `${Number(space.adminFeePct)}%`, field: "adminFeePct" });
  if (space.taxPct != null) rows.push({ label: "Tax", value: `${Number(space.taxPct)}%`, field: "taxPct" });

  const hasAny = rows.length > 0;
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[16px] font-semibold text-ink-900">Pricing</h3>
        {hasAny ? <ConfidenceBadge confidence={fieldConfidence(provenance, "fbMinimumCents", fieldConfidence(provenance, "estPerPersonLowCents"))} /> : null}
      </div>
      {hasAny ? (
        <dl className="mt-3 divide-y divide-ink-100">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between py-2 text-[14.5px]">
              <dt className="text-ink-600">
                {r.label}
                <ConfidenceBadge confidence={fieldConfidence(provenance, r.field)} compact />
              </dt>
              <dd className="font-medium text-ink-900">{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-[14.5px] text-ink-600">Pricing not yet documented. We'll get exact minimums, fees and deposits from the restaurant when you inquire.</p>
      )}
      {space.daypartMinimums.length ? (
        <div className="mt-3 rounded-xl bg-ink-50 p-3 text-[13px] text-ink-700">
          <p className="mb-1 font-medium text-ink-800">Minimum by day / time</p>
          {space.daypartMinimums.map((d) => (
            <div key={d.label} className="flex justify-between">
              <span>{d.label}</span>
              <span className="font-medium">{formatCents(d.amountCents)}</span>
            </div>
          ))}
        </div>
      ) : null}
      {est.lowCents != null ? (
        <div className="mt-4 rounded-xl border border-gold-300 bg-gold-100/60 p-3.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-gold-700">Est. all-in for {est.perPersonLowCents && est.lowCents ? Math.round(est.lowCents / est.perPersonLowCents) : guests ?? 20} guests</span>
            <span className="font-display text-[22px] text-ink-900">
              {formatCents(est.lowCents)}
              {est.highCents && est.highCents !== est.lowCents ? `–${formatCents(est.highCents)}` : ""}
            </span>
          </div>
          <p className="text-right text-[12.5px] text-ink-600">≈ {formatCents(est.perPersonLowCents)}{est.perPersonHighCents && est.perPersonHighCents !== est.perPersonLowCents ? `–${formatCents(est.perPersonHighCents)}` : ""} per person</p>
          <details className="mt-2 text-[12.5px] text-ink-600">
            <summary className="cursor-pointer text-gold-700">Assumptions</summary>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {est.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
      {space.pricingNotes ? <p className="mt-3 text-[13px] text-ink-600">{space.pricingNotes}</p> : null}
      {space.depositNotes ? <p className="mt-1 text-[13px] text-ink-600">{space.depositNotes}</p> : null}
      {space.cancellationPolicy ? (
        <p className="mt-3 text-[13px] text-ink-600">
          <span className="font-medium text-ink-800">Cancellation:</span> {space.cancellationPolicy}
        </p>
      ) : null}
    </div>
  );
}
