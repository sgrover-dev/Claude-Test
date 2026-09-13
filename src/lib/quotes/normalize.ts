/**
 * Quote normalization: turn heterogeneous restaurant pricing language into
 * comparable all-in estimates, with every assumption made explicit.
 */

export type QuoteInput = {
  guestCount: number;
  fbMinimumCents?: number | null;
  roomFeeCents?: number | null;
  perPersonCents?: number | null;
  perPersonLowCents?: number | null;
  perPersonHighCents?: number | null;
  serviceChargePct?: number | null;
  adminFeePct?: number | null;
  taxPct?: number | null;
  depositCents?: number | null;
  /** The stated minimum already covers the room fee. */
  minimumIncludesRoomFee?: boolean | null;
  /** The stated minimum is quoted inclusive of service charge and tax. */
  minimumIncludesServiceAndTax?: boolean | null;
};

export type NormalizationOptions = {
  /** Local sales tax applied when the venue did not state one. */
  defaultTaxPct?: number;
  /** Typical service charge assumed when the venue did not state one. */
  defaultServiceChargePct?: number;
};

export type NormalizedQuote = {
  guestCount: number;
  basis: "per_person" | "fb_minimum" | "per_person_vs_minimum" | "room_fee_only" | "unknown";
  foodBeverageCents: number | null;
  foodBeverageHighCents: number | null;
  roomFeeCents: number | null;
  serviceChargeCents: number | null;
  serviceChargePct: number | null;
  adminFeeCents: number | null;
  taxCents: number | null;
  taxPct: number | null;
  depositCents: number | null;
  allInCents: number | null;
  allInHighCents: number | null;
  perPersonCents: number | null;
  perPersonHighCents: number | null;
  assumptions: string[];
  confidence: "high" | "medium" | "low";
};

const round = (n: number) => Math.round(n);

export function normalizeQuote(input: QuoteInput, options: NormalizationOptions = {}): NormalizedQuote {
  const assumptions: string[] = [];
  const guests = Math.max(1, Math.floor(input.guestCount));
  const defaultTax = options.defaultTaxPct ?? 8.25;
  const defaultService = options.defaultServiceChargePct ?? 20;

  const perLow = input.perPersonCents ?? input.perPersonLowCents ?? null;
  const perHigh = input.perPersonCents ?? input.perPersonHighCents ?? perLow;
  const minimum = input.fbMinimumCents ?? null;
  const roomFee = input.roomFeeCents ?? null;

  let basis: NormalizedQuote["basis"] = "unknown";
  let foodLow: number | null = null;
  let foodHigh: number | null = null;

  if (perLow != null && minimum != null) {
    basis = "per_person_vs_minimum";
    foodLow = Math.max(perLow * guests, minimum);
    foodHigh = Math.max((perHigh ?? perLow) * guests, minimum);
    if (perLow * guests < minimum) {
      assumptions.push(
        `At ${guests} guests the per-person estimate is below the ${fmt(minimum)} minimum; the minimum applies.`,
      );
    }
  } else if (perLow != null) {
    basis = "per_person";
    foodLow = perLow * guests;
    foodHigh = (perHigh ?? perLow) * guests;
    assumptions.push("Food & beverage estimated from per-person pricing × guest count.");
  } else if (minimum != null) {
    basis = "fb_minimum";
    foodLow = minimum;
    foodHigh = minimum;
    assumptions.push("Food & beverage assumed to land at the stated minimum.");
  } else if (roomFee != null) {
    basis = "room_fee_only";
    assumptions.push("No food & beverage pricing available; only the room fee is included.");
  } else {
    assumptions.push("No pricing information available.");
  }

  const minimumIsAllIn = Boolean(input.minimumIncludesServiceAndTax) && basis !== "per_person";
  const roomIncluded = Boolean(input.minimumIncludesRoomFee) && minimum != null;

  let servicePct = input.serviceChargePct ?? null;
  if (servicePct == null && foodLow != null && !minimumIsAllIn) {
    servicePct = defaultService;
    assumptions.push(`Service charge not stated; assumed ${defaultService}% on food & beverage.`);
  }
  let taxPct = input.taxPct ?? null;
  if (taxPct == null && (foodLow != null || roomFee != null) && !minimumIsAllIn) {
    taxPct = defaultTax;
    assumptions.push(`Sales tax not stated; assumed ${defaultTax}%.`);
  }
  const adminPct = input.adminFeePct ?? null;

  const effectiveRoomFee = roomFee != null && !roomIncluded ? roomFee : roomFee != null ? 0 : null;
  if (roomIncluded) assumptions.push("Room fee is included in the stated minimum.");

  const compute = (food: number | null) => {
    if (food == null && effectiveRoomFee == null) return { service: null, admin: null, tax: null, allIn: null };
    const f = food ?? 0;
    const r = effectiveRoomFee ?? 0;
    if (minimumIsAllIn) {
      // Treat the minimum as inclusive; still add a room fee if it is separate.
      return { service: 0, admin: 0, tax: 0, allIn: round(f + r) };
    }
    const service = servicePct != null ? round((f * servicePct) / 100) : 0;
    const admin = adminPct != null ? round((f * adminPct) / 100) : 0;
    // Texas practice: tax applies to food, beverage and room rental. Mandatory
    // service charges are treated as non-taxable gratuity here (assumption).
    const tax = taxPct != null ? round(((f + r) * taxPct) / 100) : 0;
    return { service, admin, tax, allIn: round(f + r + service + admin + tax) };
  };

  if (!minimumIsAllIn && taxPct != null && (foodLow != null || effectiveRoomFee != null)) {
    assumptions.push("Tax applied to food, beverage and room fee; service charge treated as non-taxable gratuity.");
  }
  if (minimumIsAllIn) assumptions.push("Stated minimum treated as inclusive of service charge and tax.");

  const low = compute(foodLow);
  const high = compute(foodHigh);

  const confidence: NormalizedQuote["confidence"] =
    basis === "unknown" || basis === "room_fee_only"
      ? "low"
      : input.serviceChargePct != null && input.taxPct != null
        ? "high"
        : "medium";

  return {
    guestCount: guests,
    basis,
    foodBeverageCents: foodLow,
    foodBeverageHighCents: foodHigh,
    roomFeeCents: roomFee,
    serviceChargeCents: low.service,
    serviceChargePct: minimumIsAllIn ? null : servicePct,
    adminFeeCents: low.admin,
    taxCents: low.tax,
    taxPct: minimumIsAllIn ? null : taxPct,
    depositCents: input.depositCents ?? null,
    allInCents: low.allIn,
    allInHighCents: high.allIn,
    perPersonCents: low.allIn != null ? round(low.allIn / guests) : null,
    perPersonHighCents: high.allIn != null ? round(high.allIn / guests) : null,
    assumptions,
    confidence,
  };
}

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** Compare quotes side by side; returns rows sorted by all-in estimate. */
export function rankQuotes<T extends { normalized: NormalizedQuote }>(quotes: T[]): T[] {
  return [...quotes].sort((a, b) => {
    const av = a.normalized.allInCents ?? Number.POSITIVE_INFINITY;
    const bv = b.normalized.allInCents ?? Number.POSITIVE_INFINITY;
    return av - bv;
  });
}
