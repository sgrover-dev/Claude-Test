import { describe, expect, it } from "vitest";
import { completenessScore, isStale, missingFields, normalizeNameForDedupe } from "./quality";

const empty = {
  description: null, privacy: null, minGuests: null, maxSeated: null, maxStanding: null,
  fbMinimumCents: null, roomFeeCents: null, estPerPersonLowCents: null, depositCents: null,
  serviceChargePct: null, cancellationPolicy: null, amenities: [], foodStyles: [],
  availabilityMode: "request" as const, availabilityNotes: null, lastVerifiedAt: null,
};

describe("quality", () => {
  it("scores empty spaces at zero", () => expect(completenessScore(empty)).toBe(0));
  it("scores full spaces at 100", () => {
    expect(
      completenessScore({
        ...empty,
        description: "A lovely room with a long table and windows overlooking the garden.",
        privacy: "fully_private", maxSeated: 20, fbMinimumCents: 100000, amenities: ["tv"],
        foodStyles: ["plated"], photoCount: 2, depositCents: 50000, cancellationPolicy: "72h",
        availabilityNotes: "Tue–Sat", hasContact: true,
      }),
    ).toBe(100);
  });
  it("lists missing fields", () => {
    expect(missingFields({ ...empty, maxSeated: 20 }).map((c) => c.key)).not.toContain("capacity");
    expect(missingFields(empty).map((c) => c.key)).toContain("pricing");
  });
  it("detects stale records", () => {
    expect(isStale(null)).toBe(true);
    expect(isStale(new Date(Date.now() - 100 * 864e5))).toBe(true);
    expect(isStale(new Date(Date.now() - 10 * 864e5))).toBe(false);
  });
  it("normalizes names for dedupe", () => {
    expect(normalizeNameForDedupe("The Wine Room")).toBe(normalizeNameForDedupe("Wine Room (Private Dining)"));
  });
});
