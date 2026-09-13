import { describe, expect, it } from "vitest";
import { classifySpace, matchNeighborhood, parseAddress, parseVenueCsv } from "./csv";

const hoods = [
  { slug: "downtown", name: "Downtown", aliases: ["greenstreet"] },
  { slug: "galleria", name: "Galleria", aliases: ["uptown", "post oak", "uptown park"] },
  { slug: "the-heights", name: "The Heights", aliases: ["heights"] },
  { slug: "washington-avenue", name: "Washington Avenue", aliases: ["washington ave", "heights-washington"] },
  { slug: "memorial", name: "Memorial", aliases: ["memorial city", "citycentre"] },
  { slug: "rice-village", name: "Rice Village", aliases: ["west university"] },
];

describe("parseAddress", () => {
  it("parses standard addresses", () => {
    expect(parseAddress("1510 Texas Ave, Houston, TX 77002", {})).toEqual({ line1: "1510 Texas Ave", line2: null, city: "Houston", state: "TX", postalCode: "77002" });
  });
  it("handles suites and parentheticals", () => {
    const a = parseAddress("1777 Walker St, Suite A, Houston, TX 77010 (Marriott Marquis Houston)", {});
    expect(a.line1).toBe("1777 Walker St, Suite A");
    expect(a.line2).toBe("Marriott Marquis Houston");
    expect(a.postalCode).toBe("77010");
  });
  it("handles missing zip", () => {
    expect(parseAddress("At The Post Oak Hotel, Houston, TX", {})).toMatchObject({ line1: "At The Post Oak Hotel", city: "Houston", state: "TX", postalCode: null });
  });
});

describe("matchNeighborhood", () => {
  it("prefers the longest alias", () => {
    expect(matchNeighborhood("Washington Ave / Heights-Washington", hoods)).toBe("washington-avenue");
    expect(matchNeighborhood("Downtown (GreenStreet)", hoods)).toBe("downtown");
    expect(matchNeighborhood("Uptown Park", hoods)).toBe("galleria");
    expect(matchNeighborhood("CityCentre / Memorial", hoods)).toBe("memorial");
    expect(matchNeighborhood("West University", hoods)).toBe("rice-village");
    expect(matchNeighborhood("Nowhere", hoods)).toBeNull();
  });
});

describe("classifySpace", () => {
  it("maps types", () => {
    expect(classifySpace("private", "The Wine Room", "", "")).toMatchObject({ spaceType: "wine_room", privacy: "fully_private" });
    expect(classifySpace("patio", "Front Patio", "", "covered patio with heaters")).toMatchObject({ spaceType: "patio", indoorOutdoor: "covered_outdoor" });
    expect(classifySpace("full buyout", "Full Buyout (entire hotel)", "", "")).toMatchObject({ spaceType: "full_buyout", privacy: "buyout" });
    expect(classifySpace("semi-private", "Library", "", "")).toMatchObject({ spaceType: "semi_private_room", privacy: "semi_private" });
    expect(classifySpace("private", "Brennan's Ballroom", "", "")).toMatchObject({ spaceType: "event_room" });
  });
});

describe("parseVenueCsv", () => {
  const csv = `restaurant_name,address,neighborhood,private_dining_page_url,space_name,space_type,capacity_seated,capacity_standing,min_guests,amenities,pricing,event_contact_name,event_contact_email,event_contact_phone,menu_pdf_urls,source_urls,last_verified,notes
Test Steakhouse,"12 Main St, Houston, TX 77002",Downtown (GreenStreet),https://test.example/private-dining/,The Board Room,private,16,,,On-site audio/visual equipment | Valet parking,Dinner $99/person; 20% gratuity; 8.25% sales tax,Jane Doe,,(713) 555-0100,https://test.example/menu.pdf,https://test.example/private-dining/ | https://www.opentable.com/x,2026-09-12,FAQ says 12
Test Steakhouse,"12 Main St, Houston, TX 77002",Downtown (GreenStreet),https://test.example/private-dining/,,,,,,,,,,,,,2026-09-12,Restaurant-level note
Test Steakhouse,"12 Main St, Houston, TX 77002",Downtown (GreenStreet),https://test.example/private-dining/,Terrace,patio,36 (Terrace Patio) | 25 (Patio Lounge),65-90 (reception),,Heaters,"F&B minimums: lunch Thu-Fri $500; dinner Tue-Wed $1,200, Thu-Fri $1,500",,,,,https://test.example/private-dining/,2026-09-12,`;
  it("groups rows into one payload with two spaces", () => {
    const r = parseVenueCsv(csv, hoods);
    expect(r.payloads).toHaveLength(1);
    const p = r.payloads[0];
    expect(p.restaurant.name).toBe("Test Steakhouse");
    expect(p.restaurant.cuisines).toContain("steakhouse");
    expect(p.restaurant.eventsContactName).toBe("Jane Doe");
    expect(p.restaurant.internalNotes).toBe("Restaurant-level note");
    expect(p.restaurant.documents?.[0].url).toBe("https://test.example/menu.pdf");
    expect(p.location).toMatchObject({ neighborhoodSlug: "downtown", addressLine1: "12 Main St", postalCode: "77002" });
    expect(p.spaces).toHaveLength(2);
    const board = p.spaces[0];
    expect(board).toMatchObject({ spaceType: "private_dining_room", privacy: "fully_private", maxSeated: 16, estPerPersonLowCents: 9900, serviceChargePct: 20, taxPct: 8.25, verificationStatus: "publicly_listed" });
    expect(board.amenities).toEqual(expect.arrayContaining(["av_equipment", "valet"]));
    expect(board.suitableFor).toContain("board_meeting");
    expect(board.provenance?.some((x) => x.sourceType === "public_listing")).toBe(true);
    const terrace = p.spaces[1];
    expect(terrace).toMatchObject({ spaceType: "patio", maxSeated: 36, maxStanding: 90, fbMinimumCents: 120000 });
    expect(terrace.configurations).toEqual([{ name: "Terrace Patio", seated: 36, standing: null }, { name: "Patio Lounge", seated: 25, standing: null }, { name: "reception", seated: null, standing: 90 }]);
    expect(terrace.daypartMinimums?.length).toBeGreaterThanOrEqual(3);
  });
});
