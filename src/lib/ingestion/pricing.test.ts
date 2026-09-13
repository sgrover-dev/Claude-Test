import { describe, expect, it } from "vitest";
import { parseCapacityText, parsePricingText } from "./pricing";
import { mapAmenityText, mapFoodStyleText } from "./amenities";

describe("parsePricingText", () => {
  it("reads per-person lunch/dinner and fees", () => {
    const p = parsePricingText("Private lunch $79/person; private dinner $99/person (incl. nonalcoholic beverages); $175 bartender staffing fee required for groups of 35+; menus exclude service charge and tax");
    expect(p.perPersonLowCents).toBe(7900);
    expect(p.perPersonHighCents).toBe(9900);
    expect(p.fbMinimumCents).toBeNull();
    expect(p.roomFeeCents).toBeNull();
  });

  it("reads daypart minimum lists and picks the lowest dinner minimum", () => {
    const p = parsePricingText("F&B minimums: lunch Thu-Fri $500; Sat brunch $1,250; dinner Tue-Wed $1,200, Thu-Fri $1,500, Sat $2,500, Sun $1,500; setup fee $40; minimums exclude taxes, fees, and gratuity");
    expect(p.daypartMinimums.length).toBeGreaterThanOrEqual(5);
    expect(p.fbMinimumCents).toBe(120000);
    expect(p.minimumIsDerived).toBe(true);
    expect(p.daypartMinimums.find((d) => /Sat/.test(d.label) && /Dinner/.test(d.label))?.amountCents).toBe(250000);
  });

  it("reads room charges and daytime minimums", () => {
    const p = parsePricingText("Room charge: $375 Tue-Thu / $450 Fri-Sun | Daytime F&B minimum $1,000 Tue-Thu / $1,200 Fri-Sun; daytime menus $55pp mingling, $60pp family style");
    expect(p.roomFeeCents).toBe(37500);
    expect(p.perPersonLowCents).toBe(5500);
    expect(p.perPersonHighCents).toBe(6000);
    expect(p.fbMinimumCents).toBe(100000);
  });

  it("reads per-person ranges and tax", () => {
    const p = parsePricingText("Lunch menus $35-$45 per person | Dinner menus $58-$78 per person | Chef's Table menu $85 per person; 8.25% sales tax added; 20% gratuity");
    expect(p.perPersonLowCents).toBe(3500);
    expect(p.perPersonHighCents).toBe(8500);
    expect(p.taxPct).toBe(8.25);
    expect(p.serviceChargePct).toBe(20);
  });

  it("flags unpublished minimums without inventing a number", () => {
    const p = parsePricingText("A food and beverage minimum applies, based on day and time of week (amount not published)");
    expect(p.fbMinimumCents).toBeNull();
    expect(p.minimumNotPublished).toBe(true);
  });

  it("respects 'no minimums'", () => {
    const p = parsePricingText("No room rental fees or food and beverage minimums, per brochure; sample events menu at $77/person");
    expect(p.fbMinimumCents).toBeNull();
    expect(p.roomFeeCents).toBeNull();
    expect(p.perPersonLowCents).toBe(7700);
  });

  it("ignores cake cutting fees as per-person pricing", () => {
    const p = parsePricingText("all prices per person; 8.25% sales tax added; banquet fee + gratuity additional; $2/person cake-cutting fee");
    expect(p.perPersonLowCents).toBeNull();
  });
});

describe("parseCapacityText", () => {
  it("handles plain numbers and ranges", () => {
    expect(parseCapacityText("40")).toEqual({ max: 40, min: null, configurations: [] });
    expect(parseCapacityText("36-40")).toEqual({ max: 40, min: 36, configurations: [] });
  });
  it("handles multi-configuration strings", () => {
    const c = parseCapacityText("36 (Terrace Patio) | 25 (Patio Lounge)");
    expect(c.max).toBe(36);
    expect(c.configurations).toEqual([{ name: "Terrace Patio", value: 36 }, { name: "Patio Lounge", value: 25 }]);
    expect(parseCapacityText("65-90 (reception); 45 (Terrace Patio)").max).toBe(90);
  });
});

describe("amenity mapping", () => {
  it("maps feature text to keys", () => {
    const keys = mapAmenityText("Crystal chandeliers | On-site audio/visual equipment | Valet parking | Handicap accessible | Private second-floor balcony with downtown views");
    expect(keys).toEqual(expect.arrayContaining(["av_equipment", "valet", "wheelchair_accessible", "natural_light"]));
    expect(keys).not.toContain("parking");
  });
  it("maps food styles", () => {
    expect(mapFoodStyleText("Customized or a la carte menus; family-style available")).toEqual(expect.arrayContaining(["custom_menu", "a_la_carte", "family_style"]));
  });
});
