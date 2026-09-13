/**
 * CSV → InventoryPayload[]. Understands the Red Rope venue-research format
 * (one row per space, restaurant columns repeated) and common aliases.
 */
import Papa from "papaparse";
import type { CapacityConfiguration, IndoorOutdoor, PrivacyLevel, SourceType, SpaceType } from "@/db/schema";
import type { NeighborhoodHint } from "@/lib/ai/fallback";
import { mapAmenityText, mapFoodStyleText } from "./amenities";
import { parseCapacityText, parsePricingText } from "./pricing";
import type { InventoryPayload, ProvenanceInput, SpacePayload } from "./types";

const HEADER_ALIASES: Record<string, string> = {
  restaurant: "restaurant_name",
  restaurant_name: "restaurant_name",
  name: "restaurant_name",
  address: "address",
  neighborhood: "neighborhood",
  area: "neighborhood",
  private_dining_page_url: "events_page_url",
  events_page_url: "events_page_url",
  events_url: "events_page_url",
  website: "website_url",
  website_url: "website_url",
  space: "space_name",
  space_name: "space_name",
  room: "space_name",
  space_type: "space_type",
  type: "space_type",
  privacy: "privacy",
  capacity_seated: "capacity_seated",
  seated: "capacity_seated",
  max_seated: "capacity_seated",
  capacity_standing: "capacity_standing",
  standing: "capacity_standing",
  max_standing: "capacity_standing",
  min_guests: "min_guests",
  minimum_guests: "min_guests",
  amenities: "amenities",
  features: "amenities",
  pricing: "pricing",
  pricing_notes: "pricing",
  event_contact_name: "contact_name",
  contact_name: "contact_name",
  event_contact_email: "contact_email",
  contact_email: "contact_email",
  event_contact_phone: "contact_phone",
  contact_phone: "contact_phone",
  phone: "phone",
  menu_pdf_urls: "menu_urls",
  menus: "menu_urls",
  menu_urls: "menu_urls",
  source_urls: "source_urls",
  sources: "source_urls",
  source_url: "source_urls",
  last_verified: "last_verified",
  verified_on: "last_verified",
  notes: "notes",
  description: "description",
  cuisine: "cuisines",
  cuisines: "cuisines",
  photo_urls: "photo_urls",
  photos: "photo_urls",
};

export type CsvParseResult = { payloads: InventoryPayload[]; rowCount: number; skipped: string[]; unmappedNeighborhoods: string[] };

export function normalizeHeader(h: string): string {
  const key = h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return HEADER_ALIASES[key] ?? key;
}

export function parseVenueCsv(text: string, neighborhoods: NeighborhoodHint[], opts: { defaultCity?: string; defaultState?: string } = {}): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy", transformHeader: normalizeHeader });
  const rows = parsed.data.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, (v ?? "").toString().trim()])));
  const skipped: string[] = [];
  const unmapped = new Set<string>();
  const byRestaurant = new Map<string, Record<string, string>[]>();
  for (const [i, r] of rows.entries()) {
    const name = r.restaurant_name;
    if (!name) {
      skipped.push(`Row ${i + 2}: missing restaurant name`);
      continue;
    }
    byRestaurant.set(name, [...(byRestaurant.get(name) ?? []), r]);
  }

  const payloads: InventoryPayload[] = [];
  for (const [name, rs] of byRestaurant) {
    const first = rs.find((r) => r.address) ?? rs[0];
    const lastVerified = parseDate(first.last_verified);
    const address = parseAddress(first.address, opts);
    const neighborhoodSlug = matchNeighborhood(first.neighborhood, neighborhoods);
    if (first.neighborhood && !neighborhoodSlug) unmapped.add(first.neighborhood);
    const contactRow = rs.find((r) => r.contact_name || r.contact_email || r.contact_phone) ?? first;
    const noteRows = rs.filter((r) => !r.space_name && r.notes).map((r) => r.notes);
    const menuUrls = uniq(rs.flatMap((r) => splitList(r.menu_urls)));
    const restaurantSources = uniq(rs.flatMap((r) => splitList(r.source_urls)));
    const eventsPageUrl = rs.map((r) => r.events_page_url).find(Boolean) ?? null;
    const websiteUrl = rs.map((r) => r.website_url).find(Boolean) ?? (eventsPageUrl ? originOf(eventsPageUrl) : null);

    const spaces: SpacePayload[] = [];
    for (const r of rs) {
      if (!r.space_name) continue;
      spaces.push(rowToSpace(r, { restaurantName: name, lastVerified }));
    }
    if (!spaces.length && !noteRows.length) {
      skipped.push(`${name}: no spaces`);
      continue;
    }

    payloads.push({
      restaurant: {
        name,
        description: first.description || null,
        cuisines: uniq([...splitList(first.cuisines).map(slugKey), ...inferCuisines(name)]),
        websiteUrl,
        eventsPageUrl,
        phone: first.phone || null,
        eventsContactName: contactRow.contact_name || null,
        eventsContactEmail: contactRow.contact_email || null,
        eventsContactPhone: contactRow.contact_phone || null,
        contactVerifiedAt: contactRow.contact_name || contactRow.contact_email || contactRow.contact_phone ? lastVerified : null,
        internalNotes: noteRows.length ? noteRows.join("\n\n") : null,
        documents: menuUrls.map((url) => ({ title: docTitle(url), url, kind: /menu/i.test(url) ? ("menu" as const) : ("private_dining_packet" as const) })),
        provenance: restaurantSources.map((url) => ({ sourceType: sourceTypeFor(url, websiteUrl), sourceUrl: url, confidence: "publicly_listed" as const, extractedAt: lastVerified })),
      },
      location: {
        neighborhoodSlug,
        neighborhoodRaw: first.neighborhood || null,
        addressLine1: address.line1,
        addressLine2: address.line2,
        cityName: address.city,
        state: address.state,
        postalCode: address.postalCode,
      },
      spaces,
      summary: `${name}: ${spaces.length} space${spaces.length === 1 ? "" : "s"}${neighborhoodSlug ? ` · ${neighborhoodSlug}` : ""}`,
    });
  }
  return { payloads, rowCount: rows.length, skipped, unmappedNeighborhoods: Array.from(unmapped) };
}

function rowToSpace(r: Record<string, string>, ctx: { restaurantName: string; lastVerified: Date | null }): SpacePayload {
  const name = r.space_name;
  const { spaceType, privacy, indoorOutdoor } = classifySpace(r.space_type, name, r.privacy, `${r.amenities} ${r.notes}`);
  const seated = parseCapacityText(r.capacity_seated);
  const standing = parseCapacityText(r.capacity_standing);
  const configurations = mergeConfigurations(seated.configurations, standing.configurations);
  const minGuests = r.min_guests ? parseInt(r.min_guests, 10) || null : seated.min;
  const pricing = parsePricingText(r.pricing);
  const amenities = mapAmenityText(r.amenities);
  const foodStyles = uniq([...mapFoodStyleText(r.amenities), ...mapFoodStyleText(r.pricing)]);
  const sources = splitList(r.source_urls);
  const provenance: ProvenanceInput[] = [];
  for (const url of sources) {
    provenance.push({
      sourceType: sourceTypeFor(url, null),
      sourceUrl: url,
      confidence: "publicly_listed",
      fields: ["maxSeated", "maxStanding", "minGuests", "privacy", "amenities"].filter((f) => (f === "maxSeated" ? seated.max != null : f === "maxStanding" ? standing.max != null : f === "minGuests" ? minGuests != null : true)),
      extractedAt: ctx.lastVerified,
    });
  }
  if (r.pricing) {
    const numeric: string[] = [];
    if (pricing.perPersonLowCents != null) numeric.push("estPerPersonLowCents", "estPerPersonHighCents");
    if (pricing.fbMinimumCents != null && !pricing.minimumIsDerived) numeric.push("fbMinimumCents");
    if (pricing.roomFeeCents != null) numeric.push("roomFeeCents");
    if (pricing.depositCents != null) numeric.push("depositCents");
    if (pricing.serviceChargePct != null) numeric.push("serviceChargePct");
    if (pricing.taxPct != null) numeric.push("taxPct");
    if (numeric.length) provenance.push({ sourceType: sources[0] ? sourceTypeFor(sources[0], null) : "red_rope_research", sourceUrl: sources[0] ?? null, confidence: "publicly_listed", fields: numeric, note: "Parsed from listed pricing text", extractedAt: ctx.lastVerified });
    if (pricing.fbMinimumCents != null && pricing.minimumIsDerived) provenance.push({ sourceType: "red_rope_research", sourceUrl: sources[0] ?? null, confidence: "estimate", fields: ["fbMinimumCents"], note: pricing.notes.join(" "), extractedAt: ctx.lastVerified });
  }
  const featureNotes = r.amenities || null;
  const description = buildDescription({ name, restaurantName: ctx.restaurantName, spaceType, privacy, seated: seated.max, standing: standing.max, features: featureNotes, notes: r.description });
  return {
    name,
    description,
    spaceType,
    privacy,
    indoorOutdoor,
    minGuests,
    maxSeated: seated.max,
    maxStanding: standing.max,
    configurations,
    roomFeeCents: pricing.roomFeeCents,
    fbMinimumCents: pricing.fbMinimumCents,
    estPerPersonLowCents: pricing.perPersonLowCents,
    estPerPersonHighCents: pricing.perPersonHighCents,
    daypartMinimums: pricing.daypartMinimums,
    depositCents: pricing.depositCents,
    serviceChargePct: pricing.serviceChargePct,
    taxPct: pricing.taxPct,
    pricingNotes: r.pricing ? `${r.pricing}${pricing.notes.length ? ` — ${pricing.notes.join(" ")}` : ""}` : pricing.minimumNotPublished ? "Minimum applies; amount not published." : null,
    amenities,
    foodStyles,
    suitableFor: inferSuitableFor({ spaceType, privacy, seated: seated.max, standing: standing.max, amenities }),
    featureNotes,
    researchNotes: r.notes || null,
    photos: splitList(r.photo_urls).map((url) => ({ url, alt: `${name} at ${ctx.restaurantName}` })),
    verificationStatus: sources.length ? "publicly_listed" : "unverified",
    lastVerifiedAt: sources.length ? ctx.lastVerified : null,
    provenance,
    confidence: sources.length ? 0.8 : 0.5,
  };
}

/* ---------------------------------------------------------------- helpers */

export function classifySpace(rawType: string, name: string, rawPrivacy: string, context: string): { spaceType: SpaceType; privacy: PrivacyLevel | null; indoorOutdoor: IndoorOutdoor | null } {
  const t = rawType.toLowerCase();
  const n = name.toLowerCase();
  const c = context.toLowerCase();
  let spaceType: SpaceType = "other";
  let privacy: PrivacyLevel | null = null;
  let indoorOutdoor: IndoorOutdoor | null = null;

  if (/buy ?out|entire|whole restaurant/.test(t) || /buy ?out|entire (?:restaurant|hotel|venue|2nd floor|second floor)/.test(n)) {
    spaceType = "full_buyout";
    privacy = "buyout";
  } else if (/patio|terrace|garden|courtyard|deck|rooftop|roof/.test(n) || /patio|outdoor/.test(t)) {
    spaceType = /roof/.test(n) ? "rooftop" : "patio";
    indoorOutdoor = /covered|enclosed|climate/.test(c) ? "covered_outdoor" : "outdoor";
    privacy = /semi/.test(t) ? "semi_private" : /private/.test(t) ? "fully_private" : null;
  } else if (/wine|cellar/.test(n)) {
    spaceType = "wine_room";
    privacy = /semi/.test(t) ? "semi_private" : "fully_private";
  } else if (/chef'?s? table|kitchen table/.test(n)) {
    spaceType = "chefs_table";
    privacy = /semi/.test(t) ? "semi_private" : /private/.test(t) ? "fully_private" : "shared";
  } else if (/\bbar\b|lounge/.test(n) && !/private/.test(t)) {
    spaceType = "bar_lounge";
    privacy = /semi/.test(t) ? "semi_private" : "shared";
  } else if (/semi/.test(t)) {
    spaceType = "semi_private_room";
    privacy = "semi_private";
  } else if (/private/.test(t)) {
    spaceType = /upstairs|2nd floor|second floor|mezzanine/.test(n) ? "upstairs_room" : /ballroom|event|banquet|hall/.test(n) ? "event_room" : "private_dining_room";
    privacy = "fully_private";
  } else if (/main dining|dining room|section/.test(n)) {
    spaceType = "dining_section";
    privacy = "shared";
  }
  if (rawPrivacy) {
    const p = rawPrivacy.toLowerCase();
    privacy = /buy/.test(p) ? "buyout" : /semi/.test(p) ? "semi_private" : /full|private/.test(p) ? "fully_private" : /shared|open/.test(p) ? "shared" : privacy;
  }
  if (!indoorOutdoor && /balcony|al fresco|outdoor/.test(n)) indoorOutdoor = "outdoor";
  if (!indoorOutdoor && spaceType !== "patio" && spaceType !== "rooftop" && spaceType !== "full_buyout") indoorOutdoor = "indoor";
  return { spaceType, privacy, indoorOutdoor };
}

export function inferSuitableFor(s: { spaceType: SpaceType; privacy: PrivacyLevel | null; seated: number | null; standing: number | null; amenities: string[] }): string[] {
  const out = new Set<string>();
  const cap = s.seated ?? s.standing ?? 0;
  const hasAv = s.amenities.some((a) => ["av_equipment", "tv", "projector", "screen"].includes(a));
  if (s.spaceType === "full_buyout") ["holiday_party", "networking", "corporate_dinner", "cocktail_party", "alumni"].forEach((k) => out.add(k));
  if (s.spaceType === "patio" || s.spaceType === "rooftop") ["birthday", "cocktail_party", "networking", "engagement"].forEach((k) => out.add(k));
  if (s.spaceType === "bar_lounge") ["networking", "cocktail_party", "fantasy_draft", "birthday"].forEach((k) => out.add(k));
  if (s.privacy === "fully_private") {
    ["corporate_dinner", "private_dinner", "birthday"].forEach((k) => out.add(k));
    if (cap && cap <= 20) ["board_meeting", "wine_dinner"].forEach((k) => out.add(k));
    if (hasAv) ["presentation", "board_meeting"].forEach((k) => out.add(k));
    if (cap >= 30) ["rehearsal_dinner", "holiday_party", "team_offsite"].forEach((k) => out.add(k));
    if (cap >= 60) ["alumni", "networking", "engagement"].forEach((k) => out.add(k));
  }
  if (s.privacy === "semi_private") ["birthday", "club_meeting", "bible_study", "private_dinner", "team_offsite"].forEach((k) => out.add(k));
  if (s.spaceType === "wine_room") out.add("wine_dinner");
  if (s.spaceType === "chefs_table") ["private_dinner", "wine_dinner"].forEach((k) => out.add(k));
  return Array.from(out);
}

function buildDescription(p: { name: string; restaurantName: string; spaceType: SpaceType; privacy: PrivacyLevel | null; seated: number | null; standing: number | null; features: string | null; notes: string }) {
  if (p.notes) return p.notes;
  const typeLabel = { private_dining_room: "private dining room", semi_private_room: "semi-private space", patio: "patio", rooftop: "rooftop", wine_room: "wine room", chefs_table: "chef's table", bar_lounge: "bar and lounge area", dining_section: "section of the dining room", upstairs_room: "upstairs room", event_room: "event room", full_buyout: "full buyout option", other: "space" }[p.spaceType];
  const cap = p.seated ? `seats up to ${p.seated}${p.standing ? ` or hosts ${p.standing} for a standing reception` : ""}` : p.standing ? `hosts up to ${p.standing} for a standing reception` : "capacity to be confirmed";
  const features = p.features ? ` Features listed by the restaurant: ${p.features.split(/\s*\|\s*/).join("; ")}.` : "";
  return `${p.name} is a ${typeLabel} at ${p.restaurantName} that ${cap}.${features}`;
}

function mergeConfigurations(seated: { name: string; value: number }[], standing: { name: string; value: number }[]): CapacityConfiguration[] {
  const map = new Map<string, CapacityConfiguration>();
  for (const s of seated) map.set(s.name.toLowerCase(), { name: s.name, seated: s.value, standing: null });
  for (const s of standing) {
    const k = s.name.toLowerCase();
    const existing = map.get(k);
    if (existing) existing.standing = s.value;
    else map.set(k, { name: s.name, seated: null, standing: s.value });
  }
  return Array.from(map.values());
}

export function parseAddress(raw: string, opts: { defaultCity?: string; defaultState?: string }): { line1: string | null; line2: string | null; city: string | null; state: string | null; postalCode: string | null } {
  if (!raw?.trim()) return { line1: null, line2: null, city: null, state: null, postalCode: null };
  let text = raw.trim();
  let line2: string | null = null;
  const paren = text.match(/\(([^)]+)\)\s*$/);
  if (paren) {
    line2 = paren[1].trim();
    text = text.replace(paren[0], "").trim().replace(/,\s*$/, "");
  }
  const parts = text.split(/\s*,\s*/);
  let state: string | null = null;
  let postalCode: string | null = null;
  let city: string | null = null;
  const last = parts[parts.length - 1] ?? "";
  const stZip = last.match(/^([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?$/);
  if (stZip) {
    state = stZip[1];
    postalCode = stZip[2] ?? null;
    parts.pop();
    city = parts.pop() ?? null;
  } else if (/^\d{5}$/.test(last)) {
    postalCode = last;
    parts.pop();
  }
  const line1 = parts.join(", ") || null;
  return { line1, line2, city: city ?? opts.defaultCity ?? null, state: state ?? opts.defaultState ?? null, postalCode };
}

export function matchNeighborhood(raw: string | null | undefined, neighborhoods: NeighborhoodHint[]): string | null {
  if (!raw) return null;
  const text = raw.toLowerCase();
  let best: { slug: string; len: number } | null = null;
  for (const n of neighborhoods) {
    for (const alias of [n.name, n.slug.replace(/-/g, " "), ...n.aliases]) {
      const a = alias.toLowerCase();
      if (a && new RegExp(`(^|[^a-z])${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(text) && (!best || a.length > best.len)) best = { slug: n.slug, len: a.length };
    }
  }
  return best?.slug ?? null;
}

const CUISINE_HINTS: [RegExp, string][] = [
  [/steak|chop ?house|prime|butcher|grille?\b/i, "steakhouse"],
  [/seafood|oyster|fish|crab|prime seafood/i, "seafood"],
  [/osteria|trattoria|ristorante|italian|griglia|marco|cucina|pizzeria/i, "italian"],
  [/taqueria|cantina|mexican|xochi|hugo'?s|caracol|oaxac/i, "mexican"],
  [/brasserie|bistro|du parc|table\b|french/i, "french"],
  [/sushi|uchi|izakaya|omakase|japanese/i, "japanese"],
  [/churrasc|américas|americas|latin/i, "latin"],
  [/creole|cajun|brennan/i, "cajun_creole"],
  [/kiran|indian|masala/i, "indian"],
  [/bbq|barbecue|smokehouse/i, "bbq"],
  [/wine bar/i, "wine_bar"],
  [/palm\b|capital grille|seasons 52|eunice|state of grace|milton|tiny'?s|marigold|artista|bludorn|guard and grace|rainbow lodge|tonight/i, "american"],
];

function inferCuisines(name: string): string[] {
  const out = new Set<string>();
  for (const [re, key] of CUISINE_HINTS) if (re.test(name)) out.add(key);
  if (out.has("steakhouse") && out.size > 1 && /steak/i.test(name)) return ["steakhouse", ...Array.from(out).filter((k) => k !== "steakhouse" && k !== "american")].slice(0, 2);
  return Array.from(out).slice(0, 2);
}

function sourceTypeFor(url: string, ownSite: string | null): SourceType {
  const u = url.toLowerCase();
  if (/\.pdf(\?|$)/.test(u) || /menu/.test(u) && /getbento|cloudfront|squarespace|wixstatic|amazonaws/.test(u)) return "private_dining_pdf";
  if (/opentable|tagvenue|yelp|peerspace|eventective|visithouston|tripadvisor|thevendry|partyslate|google\./.test(u)) return "public_listing";
  if (ownSite && u.startsWith(ownSite.toLowerCase())) return "restaurant_website";
  return "restaurant_website";
}

function docTitle(url: string) {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? "Menu");
    return last.replace(/\.[a-z0-9]+$/i, "").replace(/[_+]/g, " ").trim().slice(0, 80) || "Menu";
  } catch {
    return "Menu";
  }
}

function originOf(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.length === 10 ? `${s}T12:00:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function splitList(s: string | undefined): string[] {
  return (s ?? "").split(/\s*[|\n]\s*|\s*,\s*(?=https?:)/).map((x) => x.trim()).filter(Boolean);
}
function uniq<T>(a: T[]) {
  return Array.from(new Set(a));
}
function slugKey(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
