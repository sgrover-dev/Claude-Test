import { describe, expect, it } from "vitest";
import { interpretRequestFallback, resolveDate, resolveTime } from "./fallback";

const hoods = [
  { slug: "galleria", name: "Galleria", aliases: ["uptown", "post oak"] },
  { slug: "montrose", name: "Montrose", aliases: [] },
  { slug: "downtown", name: "Downtown", aliases: ["dt"] },
];
const today = new Date("2026-09-13T12:00:00"); // a Sunday

describe("fallback interpreter", () => {
  it("parses the management dinner example", () => {
    const r = interpretRequestFallback(
      "I need somewhere nice but not stuffy near the Galleria for a 20-person management dinner next Tuesday. Need a screen for about 20 minutes. Around $100/person.",
      hoods,
      today,
    );
    expect(r.guests).toBe(20);
    expect(r.neighborhood).toBe("galleria");
    expect(r.eventType).toBe("corporate_dinner");
    expect(r.date).toBe("2026-09-15");
    expect(r.displayRequired).toBe(true);
    expect(r.budgetCents).toBe(10000);
    expect(r.budgetPerPerson).toBe(true);
    expect(r.ambiance).toEqual(expect.arrayContaining(["upscale", "casual"]));
    expect(r.startTime).toBe("19:00");
  });

  it("parses the Montrose cocktail party example", () => {
    const r = interpretRequestFallback(
      "Find somewhere around Montrose for about 30 people where we can do a casual cocktail party. We'd like our own area but don't need total privacy. Maybe $2,500.",
      hoods,
      today,
    );
    expect(r.guests).toBe(30);
    expect(r.neighborhood).toBe("montrose");
    expect(r.eventType).toBe("cocktail_party");
    expect(r.format).toBe("standing");
    expect(r.privacy).toEqual(expect.arrayContaining(["semi_private", "fully_private"]));
    expect(r.budgetCents).toBe(250000);
    expect(r.budgetPerPerson).toBe(false);
    expect(r.ambiance).toContain("casual");
  });

  it("does not invent guests", () => {
    const r = interpretRequestFallback("A steakhouse downtown with a projector", hoods, today);
    expect(r.guests).toBeNull();
    expect(r.cuisines).toContain("steakhouse");
    expect(r.amenities).toContain("projector");
    expect(r.neighborhood).toBe("downtown");
    expect(r.unresolved.length).toBeGreaterThan(0);
  });

  it("resolves dates and times", () => {
    expect(resolveDate("october 8th", today)).toBe("2026-10-08");
    expect(resolveDate("on 10/8", today)).toBe("2026-10-08");
    expect(resolveDate("this friday", today)).toBe("2026-09-18");
    expect(resolveDate("tomorrow", today)).toBe("2026-09-14");
    expect(resolveTime("at 7:30pm")).toBe("19:30");
    expect(resolveTime("lunch")).toBe("12:00");
    expect(resolveTime("at 7")).toBe("19:00");
    expect(resolveTime("no time here")).toBeNull();
  });
});
