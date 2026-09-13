import { describe, expect, it } from "vitest";
import { capacityFits, rankSpaces, type RankableSpace } from "./rank";
import { parseSearchParams, searchFiltersToParams } from "./params";
import { estimateSpend } from "./estimate";

const base = (over: Partial<RankableSpace>): RankableSpace => ({
  id: over.id ?? Math.random().toString(),
  name: "Room",
  restaurantName: "Rest",
  privacy: "fully_private",
  spaceType: "private_dining_room",
  indoorOutdoor: "indoor",
  minGuests: 10,
  maxSeated: 30,
  maxStanding: 45,
  fbMinimumCents: null,
  roomFeeCents: null,
  estPerPersonLowCents: null,
  estPerPersonHighCents: null,
  serviceChargePct: null,
  taxPct: null,
  amenities: [],
  foodStyles: [],
  ambiance: [],
  suitableFor: [],
  cuisines: [],
  verificationStatus: "unverified",
  completenessScore: 50,
  photoCount: 0,
  latLng: null,
  neighborhoodSlug: null,
  ...over,
});

describe("capacityFits", () => {
  it("fits within range", () => expect(capacityFits(base({}), 20)).toBe("fits"));
  it("is tight just above max", () => expect(capacityFits(base({}), 32)).toBe("tight"));
  it("rejects far above max", () => expect(capacityFits(base({}), 50)).toBe("no"));
  it("uses standing capacity for receptions", () => expect(capacityFits(base({}), 40, "standing")).toBe("fits"));
  it("is tight below minimum but close", () => expect(capacityFits(base({}), 8)).toBe("tight"));
  it("keeps unknown capacity as tight", () => expect(capacityFits(base({ maxSeated: null, maxStanding: null }), 20)).toBe("tight"));
});

describe("rankSpaces", () => {
  it("drops spaces that cannot hold the group", () => {
    const r = rankSpaces([base({ id: "small", maxSeated: 12, maxStanding: 12 }), base({ id: "big" })], { city: "houston", guests: 25 });
    expect(r.map((x) => x.space.id)).toEqual(["big"]);
  });

  it("prefers matching privacy and AV", () => {
    const withAv = base({ id: "av", amenities: ["projector", "screen"] });
    const noAv = base({ id: "noav" });
    const r = rankSpaces([noAv, withAv], { city: "houston", guests: 20, privacy: ["fully_private"], avRequired: true });
    expect(r[0].space.id).toBe("av");
    expect(r[0].reasons).toContain("AV available");
  });

  it("scores budget fit and explains overages", () => {
    const cheap = base({ id: "cheap", fbMinimumCents: 150000, serviceChargePct: 20, taxPct: 8.25 });
    const pricey = base({ id: "pricey", fbMinimumCents: 600000, serviceChargePct: 20, taxPct: 8.25 });
    const r = rankSpaces([pricey, cheap], { city: "houston", guests: 20, budgetCents: 300000 });
    expect(r[0].space.id).toBe("cheap");
    expect(r[0].reasons).toContain("Within budget");
    expect(r[1].warnings).toContain("Likely above budget");
  });

  it("boosts the requested neighborhood", () => {
    const inHood = base({ id: "in", neighborhoodSlug: "montrose" });
    const out = base({ id: "out", neighborhoodSlug: "heights" });
    const r = rankSpaces([out, inHood], { city: "houston", neighborhood: "montrose" });
    expect(r[0].space.id).toBe("in");
  });

  it("sorts by price when asked", () => {
    const a = base({ id: "a", fbMinimumCents: 500000 });
    const b = base({ id: "b", fbMinimumCents: 100000 });
    const c = base({ id: "c" });
    expect(rankSpaces([a, c, b], { city: "houston", sort: "price_asc" }).map((x) => x.space.id)).toEqual(["b", "a", "c"]);
  });
});

describe("estimateSpend", () => {
  it("labels minimums", () => {
    const e = estimateSpend({ fbMinimumCents: 250000, roomFeeCents: null, estPerPersonLowCents: null, estPerPersonHighCents: null, serviceChargePct: null, taxPct: null }, 20);
    expect(e.label).toBe("Minimum $2,500");
    expect(e.lowCents).toBeGreaterThan(250000);
  });
  it("labels per-person ranges", () => {
    const e = estimateSpend({ fbMinimumCents: null, roomFeeCents: null, estPerPersonLowCents: 8500, estPerPersonHighCents: 12000, serviceChargePct: "20", taxPct: "8.25" }, 20);
    expect(e.label).toBe("Est. $85–$120/person");
  });
});

describe("search params", () => {
  it("round-trips filters", () => {
    const f = parseSearchParams({ guests: "25", privacy: "fully_private,semi_private", av: "1", budget: "3000", neighborhood: "montrose", date: "2026-10-08", time: "19:00" });
    expect(f.guests).toBe(25);
    expect(f.privacy).toEqual(["fully_private", "semi_private"]);
    expect(f.avRequired).toBe(true);
    expect(f.budgetCents).toBe(300000);
    const qs = searchFiltersToParams(f);
    expect(qs.get("guests")).toBe("25");
    expect(qs.get("budget")).toBe("3000");
    expect(qs.get("privacy")).toBe("fully_private,semi_private");
    expect(qs.get("date")).toBe("2026-10-08");
  });
  it("ignores garbage", () => {
    const f = parseSearchParams({ guests: "abc", date: "next thursday", sort: "nope" });
    expect(f.guests).toBeUndefined();
    expect(f.date).toBeUndefined();
    expect(f.sort).toBe("relevance");
    expect(f.city).toBe("houston");
  });
});
