import { describe, expect, it } from "vitest";
import { normalizeQuote, rankQuotes } from "./normalize";
import { parseQuoteText } from "./parse";

describe("normalizeQuote", () => {
  it("Restaurant A: $2,500 F&B minimum + 20% gratuity + tax", () => {
    const n = normalizeQuote({ guestCount: 25, fbMinimumCents: 250000, serviceChargePct: 20, taxPct: 8.25 });
    expect(n.basis).toBe("fb_minimum");
    expect(n.foodBeverageCents).toBe(250000);
    expect(n.serviceChargeCents).toBe(50000);
    expect(n.taxCents).toBe(Math.round(250000 * 0.0825));
    expect(n.allInCents).toBe(250000 + 50000 + Math.round(250000 * 0.0825));
    expect(n.confidence).toBe("high");
    expect(n.perPersonCents).toBe(Math.round(n.allInCents! / 25));
  });

  it("Restaurant B: $85/person + $500 room fee (service and tax assumed)", () => {
    const n = normalizeQuote({ guestCount: 25, perPersonCents: 8500, roomFeeCents: 50000 });
    expect(n.basis).toBe("per_person");
    expect(n.foodBeverageCents).toBe(212500);
    expect(n.roomFeeCents).toBe(50000);
    expect(n.serviceChargePct).toBe(20);
    expect(n.taxPct).toBe(8.25);
    expect(n.assumptions.some((a) => a.includes("Service charge not stated"))).toBe(true);
    expect(n.assumptions.some((a) => a.includes("Sales tax not stated"))).toBe(true);
    const expected = 212500 + 50000 + 42500 + Math.round((212500 + 50000) * 0.0825);
    expect(n.allInCents).toBe(expected);
    expect(n.confidence).toBe("medium");
  });

  it("Restaurant C: $3,000 minimum inclusive of room", () => {
    const n = normalizeQuote({
      guestCount: 25,
      fbMinimumCents: 300000,
      roomFeeCents: 40000,
      minimumIncludesRoomFee: true,
      serviceChargePct: 18,
      taxPct: 8.25,
    });
    expect(n.foodBeverageCents).toBe(300000);
    // room fee is not added on top
    expect(n.allInCents).toBe(300000 + 54000 + Math.round(300000 * 0.0825));
    expect(n.assumptions).toContain("Room fee is included in the stated minimum.");
  });

  it("treats an all-inclusive minimum as the all-in figure", () => {
    const n = normalizeQuote({ guestCount: 10, fbMinimumCents: 150000, minimumIncludesServiceAndTax: true });
    expect(n.allInCents).toBe(150000);
    expect(n.serviceChargePct).toBeNull();
    expect(n.taxPct).toBeNull();
  });

  it("applies the minimum when per-person × guests falls short", () => {
    const n = normalizeQuote({ guestCount: 10, perPersonCents: 8000, fbMinimumCents: 250000, serviceChargePct: 20, taxPct: 8 });
    expect(n.basis).toBe("per_person_vs_minimum");
    expect(n.foodBeverageCents).toBe(250000);
    expect(n.assumptions[0]).toMatch(/minimum applies/);
  });

  it("produces a range from per-person low/high", () => {
    const n = normalizeQuote({ guestCount: 20, perPersonLowCents: 7500, perPersonHighCents: 12000, serviceChargePct: 20, taxPct: 8.25 });
    expect(n.allInCents).toBeLessThan(n.allInHighCents!);
    expect(n.perPersonHighCents).toBeGreaterThan(n.perPersonCents!);
  });

  it("returns unknown with low confidence when no pricing exists", () => {
    const n = normalizeQuote({ guestCount: 30 });
    expect(n.basis).toBe("unknown");
    expect(n.allInCents).toBeNull();
    expect(n.confidence).toBe("low");
  });

  it("ranks quotes by all-in with unknowns last", () => {
    const a = { id: "a", normalized: normalizeQuote({ guestCount: 10, fbMinimumCents: 200000 }) };
    const b = { id: "b", normalized: normalizeQuote({ guestCount: 10, fbMinimumCents: 100000 }) };
    const c = { id: "c", normalized: normalizeQuote({ guestCount: 10 }) };
    expect(rankQuotes([a, c, b]).map((q) => q.id)).toEqual(["b", "a", "c"]);
  });
});

describe("parseQuoteText", () => {
  it("extracts minimum, gratuity and tax", () => {
    const p = parseQuoteText("We require a $2,500 F&B minimum plus 20% gratuity and 8.25% sales tax.", 25);
    expect(p.fbMinimumCents).toBe(250000);
    expect(p.serviceChargePct).toBe(20);
    expect(p.taxPct).toBe(8.25);
    expect(p.minimumIncludesServiceAndTax).toBe(false);
  });
  it("extracts per-person and room fee and deposit", () => {
    const p = parseQuoteText("Our set menus start at $85 per person and there is a $500 room fee. A $1,000 deposit holds the date.", 20);
    expect(p.perPersonCents).toBe(8500);
    expect(p.roomFeeCents).toBe(50000);
    expect(p.depositCents).toBe(100000);
  });
  it("detects inclusive minimums", () => {
    const p = parseQuoteText("The minimum spend is $3,000 inclusive of the room and tax.", 20);
    expect(p.fbMinimumCents).toBe(300000);
    expect(p.minimumIncludesRoomFee).toBe(true);
  });
  it("does not invent values", () => {
    const p = parseQuoteText("Happy to host you! Let us know the date.", 20);
    expect(p.fbMinimumCents).toBeUndefined();
    expect(p.perPersonCents).toBeUndefined();
  });
});
