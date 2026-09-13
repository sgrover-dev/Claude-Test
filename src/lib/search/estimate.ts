import { normalizeQuote, type NormalizedQuote } from "@/lib/quotes/normalize";

export type SpendEstimateInput = {
  fbMinimumCents: number | null;
  roomFeeCents: number | null;
  estPerPersonLowCents: number | null;
  estPerPersonHighCents: number | null;
  serviceChargePct: string | number | null;
  taxPct: string | number | null;
  depositCents?: number | null;
};

export type SpendEstimate = {
  lowCents: number | null;
  highCents: number | null;
  perPersonLowCents: number | null;
  perPersonHighCents: number | null;
  minimumCents: number | null;
  basis: NormalizedQuote["basis"];
  label: string; // "Estimated minimum: $2,500" / "Est. $85–$120/person"
  assumptions: string[];
};

const num = (v: string | number | null | undefined) => (v == null ? null : Number(v));

/** Estimate what a group of `guests` would spend in a space, using stored pricing. */
export function estimateSpend(space: SpendEstimateInput, guests: number | undefined, defaultTaxPct = 8.25): SpendEstimate {
  const g = guests && guests > 0 ? guests : 20;
  const n = normalizeQuote(
    {
      guestCount: g,
      fbMinimumCents: space.fbMinimumCents,
      roomFeeCents: space.roomFeeCents,
      perPersonLowCents: space.estPerPersonLowCents,
      perPersonHighCents: space.estPerPersonHighCents,
      serviceChargePct: num(space.serviceChargePct),
      taxPct: num(space.taxPct),
      depositCents: space.depositCents,
    },
    { defaultTaxPct },
  );

  let label = "Pricing on request";
  if (space.fbMinimumCents != null) label = `Minimum ${fmt(space.fbMinimumCents)}`;
  else if (space.estPerPersonLowCents != null) {
    label = `Est. ${fmt(space.estPerPersonLowCents)}${
      space.estPerPersonHighCents && space.estPerPersonHighCents !== space.estPerPersonLowCents
        ? `–${fmt(space.estPerPersonHighCents)}`
        : ""
    }/person`;
  } else if (space.roomFeeCents != null) label = `Room fee ${fmt(space.roomFeeCents)}`;

  return {
    lowCents: n.allInCents,
    highCents: n.allInHighCents,
    perPersonLowCents: n.perPersonCents,
    perPersonHighCents: n.perPersonHighCents,
    minimumCents: space.fbMinimumCents,
    basis: n.basis,
    label,
    assumptions: n.assumptions,
  };
}

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
