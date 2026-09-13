/**
 * Deterministic fallbacks used when no AI credentials are configured (or the
 * model call fails). They are intentionally conservative: extract what the
 * text plainly says and leave everything else null.
 */
import { AMENITIES, CUISINES, EVENT_TYPES } from "@/lib/taxonomy";
import type { InterpretedRequest } from "./schemas";

export type NeighborhoodHint = { slug: string; name: string; aliases: string[] };

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function resolveDate(text: string, today: Date): string | null {
  const t = text.toLowerCase();
  if (/\btomorrow\b/.test(t)) return iso(new Date(today.getTime() + 864e5));
  if (/\btonight\b|\btoday\b/.test(t)) return iso(today);
  const wd = t.match(/\b(next|this|coming)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[2]);
    const d = new Date(today);
    let delta = (target - d.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    d.setDate(d.getDate() + delta);
    return iso(d);
  }
  const md = t.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (md) {
    const month = MONTHS.findIndex((m) => m.startsWith(md[1].slice(0, 3)));
    const d = new Date(today.getFullYear(), month, parseInt(md[2], 10));
    if (d.getTime() < today.getTime() - 864e5) d.setFullYear(d.getFullYear() + 1);
    return iso(d);
  }
  const num = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (num) {
    const year = num[3] ? (num[3].length === 2 ? 2000 + parseInt(num[3], 10) : parseInt(num[3], 10)) : today.getFullYear();
    const d = new Date(year, parseInt(num[1], 10) - 1, parseInt(num[2], 10));
    if (!num[3] && d.getTime() < today.getTime() - 864e5) d.setFullYear(d.getFullYear() + 1);
    return iso(d);
  }
  return null;
}

export function resolveTime(text: string): string | null {
  const t = text.toLowerCase();
  const m = t.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2] ?? "00";
    const pm = m[3].startsWith("p");
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${min}`;
  }
  const at = t.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/);
  if (at) {
    let h = parseInt(at[1], 10);
    if (h >= 1 && h <= 9) h += 12; // "at 7" → 19:00 for dinner-heavy use
    return `${String(h).padStart(2, "0")}:${at[2] ?? "00"}`;
  }
  if (/\bbrunch\b/.test(t)) return "11:00";
  if (/\blunch\b|\bnoon\b|\bmidday\b/.test(t)) return "12:00";
  if (/\bhappy hour\b/.test(t)) return "17:00";
  if (/\bdinner\b|\bevening\b/.test(t)) return "19:00";
  return null;
}

const EVENT_KEYWORDS: [RegExp, string][] = [
  [/rehearsal/i, "rehearsal_dinner"],
  [/birthday|bday|turning \d+/i, "birthday"],
  [/baby shower/i, "baby_shower"],
  [/bridal shower/i, "bridal_shower"],
  [/holiday|christmas|xmas|hanukkah|end[- ]of[- ]year/i, "holiday_party"],
  [/fantasy (?:football )?draft|draft party/i, "fantasy_draft"],
  [/board meeting|board dinner/i, "board_meeting"],
  [/presentation|pitch|demo|all[- ]hands|town ?hall/i, "presentation"],
  [/networking|mixer|happy hour|meetup/i, "networking"],
  [/alumni|reunion/i, "alumni"],
  [/bible study|small group|prayer/i, "bible_study"],
  [/club meeting|rotary|chapter meeting/i, "club_meeting"],
  [/engagement/i, "engagement"],
  [/retirement/i, "retirement"],
  [/graduation/i, "graduation"],
  [/offsite|off-site|team building|team dinner|team outing/i, "team_offsite"],
  [/wine dinner|wine pairing/i, "wine_dinner"],
  [/cocktail|reception/i, "cocktail_party"],
  [/management dinner|client dinner|corporate|company dinner|work dinner|business dinner|executive|leadership/i, "corporate_dinner"],
  [/private dinner|dinner party|family dinner|anniversary/i, "private_dinner"],
];

const CUISINE_KEYWORDS: [RegExp, string][] = [
  [/steak|steakhouse/i, "steakhouse"],
  [/italian|pasta|pizza/i, "italian"],
  [/tex[- ]?mex|fajitas/i, "tex_mex"],
  [/mexican|tacos|oaxacan/i, "mexican"],
  [/sushi/i, "sushi"],
  [/japanese|omakase|izakaya/i, "japanese"],
  [/seafood|oyster|crab/i, "seafood"],
  [/bbq|barbecue|brisket/i, "bbq"],
  [/indian/i, "indian"],
  [/french|bistro|brasserie/i, "french"],
  [/mediterranean|lebanese|turkish/i, "mediterranean"],
  [/cajun|creole/i, "cajun_creole"],
  [/southern|soul food/i, "southern"],
  [/chinese|dim sum/i, "chinese"],
  [/vietnamese|pho/i, "vietnamese"],
  [/thai/i, "thai"],
  [/spanish|tapas/i, "spanish"],
  [/greek/i, "greek"],
  [/deli/i, "deli"],
  [/wine bar/i, "wine_bar"],
];

const AMBIANCE_KEYWORDS: [RegExp, string][] = [
  [/upscale|fancy|elegant|fine dining|white tablecloth|impress|nice\b/i, "upscale"],
  [/casual|laid[- ]back|relaxed|low[- ]key|not stuffy|chill/i, "casual"],
  [/lively|fun|energetic|buzzy|loud is fine/i, "lively"],
  [/quiet|calm|conversation/i, "quiet"],
  [/intimate|cozy/i, "intimate"],
  [/romantic/i, "romantic"],
  [/trendy|hip|cool spot|scene/i, "trendy"],
  [/modern|sleek/i, "modern"],
  [/classic|old[- ]school|traditional/i, "classic"],
  [/rustic/i, "rustic"],
  [/view|skyline|scenic/i, "scenic_view"],
  [/historic/i, "historic"],
];

function parseMoney(raw: string): number | null {
  let s = raw.replace(/[$,\s]/g, "").toLowerCase();
  let mult = 1;
  if (s.endsWith("k")) {
    mult = 1000;
    s = s.slice(0, -1);
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * mult * 100) : null;
}

export function interpretRequestFallback(text: string, neighborhoods: NeighborhoodHint[], today = new Date()): InterpretedRequest {
  const t = text.replace(/\s+/g, " ").trim();
  const lower = t.toLowerCase();
  const unresolved: string[] = [];

  // Guests
  let guests: number | null = null;
  const gm =
    lower.match(/\b(\d{1,3})\s*(?:-|to)\s*(\d{1,3})\s*(?:people|guests|ppl|persons|folks|pax|heads|attendees|colleagues)\b/) ||
    lower.match(/\b(\d{1,3})\s*(?:people|guests|ppl|persons|folks|pax|heads|attendees|colleagues|-person|person)\b/) ||
    lower.match(/\b(?:party|group|team) of\s*(\d{1,3})\b/) ||
    lower.match(/\bfor\s*(?:about|around|roughly|~)?\s*(\d{1,3})\b(?!\s*(?:minutes|min|hours|hrs|pm|am|:))/);
  if (gm) guests = gm[2] ? Math.round((parseInt(gm[1], 10) + parseInt(gm[2], 10)) / 2) : parseInt(gm[1], 10);

  // Budget
  let budgetCents: number | null = null;
  let budgetPerPerson: boolean | null = null;
  const pp = lower.match(/\$\s?([\d,.]+k?)\s*(?:\/|per|a|each)\s*(?:person|pp|head|guest)?/);
  const perPersonHit = pp && /(?:\/|per|a|each)\s*(?:person|pp|head|guest)/.test(pp[0]);
  if (perPersonHit) {
    budgetCents = parseMoney(pp[1]);
    budgetPerPerson = true;
  } else {
    const total = lower.match(/(?:budget(?: is| of)?|around|about|roughly|under|up to|max(?:imum)?|~)\s*\$\s?([\d,.]+k?)\b/) || lower.match(/\$\s?([\d,.]+k?)\b/);
    if (total) {
      budgetCents = parseMoney(total[1]);
      budgetPerPerson = false;
    }
  }

  // Neighborhood
  let neighborhood: string | null = null;
  for (const n of neighborhoods) {
    const names = [n.name, ...n.aliases].map((x) => x.toLowerCase());
    if (names.some((name) => new RegExp(`\\b${escapeRe(name)}\\b`).test(lower))) {
      neighborhood = n.slug;
      break;
    }
  }

  // Privacy
  const privacy: InterpretedRequest["privacy"] = [];
  if (/buy ?out|whole restaurant|entire restaurant/.test(lower)) privacy.push("buyout");
  if (/fully private|completely private|private room|own room|closed door|totally private|full privacy/.test(lower)) privacy.push("fully_private");
  if (/semi[- ]private|own area|own section|don'?t need (?:total|full|complete) privacy|not (?:totally|fully) private|partially private/.test(lower)) {
    privacy.push("semi_private");
    if (!privacy.includes("fully_private") && /own area|own section|don'?t need/.test(lower)) privacy.push("fully_private");
  } else if (!privacy.length && /\bprivate\b/.test(lower)) privacy.push("fully_private");

  // Event type
  let eventType: string | null = null;
  for (const [re, key] of EVENT_KEYWORDS) {
    if (re.test(t)) {
      eventType = key;
      break;
    }
  }

  // Format
  let format: InterpretedRequest["format"] = null;
  if (/standing|reception|mingle|cocktail[- ]style|cocktail party/.test(lower)) format = "standing";
  else if (/seated|sit[- ]down|dinner|lunch|brunch/.test(lower)) format = "seated";

  // Amenities / AV
  const amenities: string[] = [];
  const displayRequired = /\b(screen|projector|tv|television|slides?|slideshow|powerpoint|deck|presentation|present\b)/.test(lower);
  const avRequired = displayRequired || /\b(av|a\/v|microphone|mic\b|speakers|sound system|audio)\b/.test(lower);
  if (/\bprojector\b/.test(lower)) amenities.push("projector");
  if (/\bscreen\b/.test(lower)) amenities.push("screen");
  if (/\btv\b|television/.test(lower)) amenities.push("tv");
  if (/\bmic(?:rophone)?\b/.test(lower)) amenities.push("microphone");
  if (/\bfireplace\b/.test(lower)) amenities.push("fireplace");
  if (/\bdance floor|dancing\b/.test(lower)) amenities.push("dance_floor");
  if (/\bwi-?fi\b/.test(lower)) amenities.push("wifi");
  if (/\bseparate entrance\b/.test(lower)) amenities.push("separate_entrance");
  const privateBar = /private bar|own bar|dedicated bar/.test(lower);
  const parking = /valet|parking/.test(lower);
  const accessible = /wheelchair|accessible|ada\b|mobility/.test(lower);

  // Setting / types
  const indoorOutdoor: InterpretedRequest["indoorOutdoor"] = [];
  const spaceTypes: string[] = [];
  if (/\boutdoor|outside|al fresco\b/.test(lower)) indoorOutdoor.push("outdoor", "covered_outdoor");
  if (/\bpatio\b/.test(lower)) spaceTypes.push("patio");
  if (/\brooftop|roof\b/.test(lower)) spaceTypes.push("rooftop");
  if (/\bwine room|wine cellar\b/.test(lower)) spaceTypes.push("wine_room");
  if (/\bchef'?s table\b/.test(lower)) spaceTypes.push("chefs_table");
  if (/\bindoor(?:s)? only\b/.test(lower)) indoorOutdoor.push("indoor");

  // Cuisine, ambiance, food styles
  const cuisines = CUISINE_KEYWORDS.filter(([re]) => re.test(t)).map(([, k]) => k);
  const ambiance = AMBIANCE_KEYWORDS.filter(([re]) => re.test(t)).map(([, k]) => k);
  const foodStyles: string[] = [];
  if (/family[- ]style/.test(lower)) foodStyles.push("family_style");
  if (/buffet/.test(lower)) foodStyles.push("buffet");
  if (/prix[- ]fixe|set menu|fixed menu/.test(lower)) foodStyles.push("prix_fixe");
  if (/plated|three[- ]course|multi[- ]course/.test(lower)) foodStyles.push("plated");
  if (/passed (?:apps|appetizers|hors)|heavy apps|small bites/.test(lower)) foodStyles.push("passed_appetizers");
  if (/cocktail|reception/.test(lower)) foodStyles.push("cocktail_reception");
  if (/tasting menu|omakase/.test(lower)) foodStyles.push("chef_tasting");

  // Duration
  let durationMinutes: number | null = null;
  const dur = lower.match(/\b(\d+(?:\.\d+)?)\s*(hours?|hrs?)\b/);
  if (dur) durationMinutes = Math.round(parseFloat(dur[1]) * 60);

  const date = resolveDate(t, today);
  const startTime = resolveTime(t);

  if (!guests) unresolved.push("Guest count not found — add it for better matches.");
  if (/near|close to|within \d+ (?:min|minutes)/.test(lower) && !neighborhood) unresolved.push("Could not map the location you mentioned to a neighborhood.");

  const known = new Set(AMENITIES.map((a) => a.key));
  const validEvent = EVENT_TYPES.some((e) => e.key === eventType) ? (eventType as InterpretedRequest["eventType"]) : null;
  const validCuisines = cuisines.filter((c) => CUISINES.some((x) => x.key === c));

  return {
    summary: buildSummary({ guests, eventType: validEvent, neighborhood: neighborhoods.find((n) => n.slug === neighborhood)?.name ?? null, date, budgetCents, budgetPerPerson }),
    neighborhood,
    date,
    startTime,
    guests,
    eventType: validEvent,
    budgetCents,
    budgetPerPerson,
    privacy: Array.from(new Set(privacy)),
    cuisines: validCuisines as InterpretedRequest["cuisines"],
    ambiance: ambiance as InterpretedRequest["ambiance"],
    foodStyles: foodStyles as InterpretedRequest["foodStyles"],
    indoorOutdoor: Array.from(new Set(indoorOutdoor)) as InterpretedRequest["indoorOutdoor"],
    amenities: Array.from(new Set(amenities.filter((a) => known.has(a as never)))) as InterpretedRequest["amenities"],
    avRequired,
    displayRequired,
    privateBar,
    parking,
    accessible,
    format,
    durationMinutes,
    spaceTypes: spaceTypes as InterpretedRequest["spaceTypes"],
    unresolved,
  };
}

function buildSummary(p: { guests: number | null; eventType: string | null; neighborhood: string | null; date: string | null; budgetCents: number | null; budgetPerPerson: boolean | null }) {
  const parts: string[] = [];
  parts.push(p.eventType ? EVENT_TYPES.find((e) => e.key === p.eventType)?.label ?? "Event" : "Group event");
  if (p.guests) parts.push(`for ${p.guests}`);
  if (p.neighborhood) parts.push(`near ${p.neighborhood}`);
  if (p.date) parts.push(`on ${p.date}`);
  if (p.budgetCents) parts.push(`around $${Math.round(p.budgetCents / 100).toLocaleString()}${p.budgetPerPerson ? "/person" : ""}`);
  return parts.join(" ");
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
