/**
 * Parses free-text pricing descriptions from restaurant materials into
 * structured fields. Conservative: only records what the text states and
 * explains any derivation in `notes`.
 */
import type { DaypartMinimum } from "@/db/schema";

export type ParsedPricing = {
  perPersonLowCents: number | null;
  perPersonHighCents: number | null;
  fbMinimumCents: number | null;
  minimumIsDerived: boolean; // true when chosen from several daypart minimums
  daypartMinimums: DaypartMinimum[];
  roomFeeCents: number | null;
  depositCents: number | null;
  serviceChargePct: number | null;
  taxPct: number | null;
  minimumNotPublished: boolean;
  notes: string[];
};

const money = (s: string) => Math.round(parseFloat(s.replace(/[$,]/g, "")) * 100);
const MONEY = String.raw`\$\s?([\d,]+(?:\.\d{1,2})?)`;
const DAYPART = String.raw`(?:(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*(?:\s*[-–/&]\s*(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*)*|weekday|weekend|weeknight|lunch|brunch|dinner|daytime|evening|happy hour|game nights?)`;

export function parsePricingText(text: string | null | undefined): ParsedPricing {
  const out: ParsedPricing = {
    perPersonLowCents: null,
    perPersonHighCents: null,
    fbMinimumCents: null,
    minimumIsDerived: false,
    daypartMinimums: [],
    roomFeeCents: null,
    depositCents: null,
    serviceChargePct: null,
    taxPct: null,
    minimumNotPublished: false,
    notes: [],
  };
  if (!text?.trim()) return out;
  const t = text.replace(/\s+/g, " ");

  // Per-person values, including ranges like "$35-$45 per person" and "$60pp".
  const pp: number[] = [];
  const ppRange = new RegExp(String.raw`${MONEY}\s*[-–]\s*${MONEY}\s*(?:\/|per|pp\b|a)\s*(?:person|guest|head|pp)?`, "gi");
  for (const m of t.matchAll(ppRange)) pp.push(money(m[1]), money(m[2]));
  const ppSingle = new RegExp(String.raw`${MONEY}\s*(?:\/|per|pp\b)\s*(?:person|guest|head|pp)?(?!\s*(?:hour|hr))`, "gi");
  for (const m of t.matchAll(ppSingle)) {
    const before = t.slice(Math.max(0, m.index! - 12), m.index!);
    if (/[-–]\s*$/.test(before)) continue; // part of a range already captured
    if (/(?:fee|cake|cutting|corkage|bartender|staffing|setup)\s*(?:of)?\s*$/i.test(before)) continue;
    if (/cake|cutting|corkage/i.test(t.slice(m.index!, m.index! + 60)) && !/menu|lunch|dinner|brunch/i.test(before)) continue;
    pp.push(money(m[1]));
  }
  if (pp.length) {
    out.perPersonLowCents = Math.min(...pp);
    out.perPersonHighCents = Math.max(...pp);
  }

  // Minimums: "$500 minimum", "F&B minimum $1,000", "minimum spend of $3,000",
  // and daypart lists "lunch Thu-Fri $500; Sat brunch $1,250; dinner Tue-Wed $1,200".
  if (/minimum/i.test(t)) {
    const dayparts: DaypartMinimum[] = [];
    const listRe = new RegExp(String.raw`((?:${DAYPART})(?:\s+(?:${DAYPART}))*)\s*:?\s*${MONEY}(?!\s*(?:\/|per|pp\b))`, "gi");
    let context = "";
    for (const m of t.matchAll(listRe)) {
      const label = m[1].trim();
      // Carry the last meal-period word (lunch/dinner/brunch) forward across "Thu-Fri $1,500" entries.
      const meal = label.match(/lunch|brunch|dinner|daytime|evening|happy hour/i)?.[0];
      if (meal) context = meal.toLowerCase();
      const fullLabel = meal || !context ? label : `${context} ${label}`;
      dayparts.push({ label: titleCase(fullLabel), amountCents: money(m[2]) });
    }
    if (dayparts.length >= 2) {
      out.daypartMinimums = dedupeDayparts(dayparts);
      const dinner = out.daypartMinimums.filter((d) => /dinner|evening/i.test(d.label));
      const pool = dinner.length ? dinner : out.daypartMinimums;
      out.fbMinimumCents = Math.min(...pool.map((d) => d.amountCents));
      out.minimumIsDerived = true;
      out.notes.push(`Headline minimum is the lowest ${dinner.length ? "dinner" : "listed"} minimum; see minimums by day/time.`);
    } else {
      const single =
        t.match(new RegExp(String.raw`${MONEY}\s*(?:\+\s*)?(?:f\s*&\s*b|food\s*(?:and|&)\s*beverage)?\s*minimum`, "i")) ||
        t.match(new RegExp(String.raw`minimum(?:s)?\s*(?:spend|of|is|:)?\s*(?:of|is|:)?\s*${MONEY}`, "i")) ||
        t.match(new RegExp(String.raw`minimum[^.;$]{0,40}?${MONEY}`, "i"));
      if (single) out.fbMinimumCents = money(single[1]);
      else if (dayparts.length === 1) {
        out.fbMinimumCents = dayparts[0].amountCents;
        out.daypartMinimums = dayparts;
      }
    }
    if (/(?:amount|minimums?) not (?:published|listed|disclosed|specified)|not published/i.test(t)) out.minimumNotPublished = true;
    if (/no (?:room rental fees? or )?(?:food and beverage |f&b )?minimums?/i.test(t)) {
      out.fbMinimumCents = null;
      out.daypartMinimums = [];
      out.notes.push("Source states no food & beverage minimum.");
    }
  }

  // Room / rental fee.
  const room =
    t.match(new RegExp(String.raw`(?:room|rental|venue|site|space)\s*(?:rental\s*)?(?:fee|charge|rate)s?\s*(?:of|is|:|starts? at|from)?\s*${MONEY}`, "i")) ||
    t.match(new RegExp(String.raw`${MONEY}\s*(?:room|rental|venue|site)\s*(?:rental\s*)?(?:fee|charge)`, "i"));
  if (room) out.roomFeeCents = money(room[1]);
  if (/no room (?:rental )?fees?/i.test(t)) out.roomFeeCents = null;

  const deposit = t.match(new RegExp(String.raw`${MONEY}\s*(?:[a-z-]+\s){0,2}deposit`, "i")) || t.match(new RegExp(String.raw`deposit\s*(?:of|is|:)?\s*${MONEY}`, "i"));
  if (deposit) out.depositCents = money(deposit[1]);

  const service = t.match(/(\d{1,2}(?:\.\d+)?)\s*%\s*(?:service|gratuity|grat\b|tip|banquet fee)/i) || t.match(/(?:service charge|gratuity|banquet fee)\s*(?:of|is|:)?\s*(\d{1,2}(?:\.\d+)?)\s*%/i);
  if (service) out.serviceChargePct = parseFloat(service[1]);
  const tax = t.match(/(\d{1,2}(?:\.\d+)?)\s*%\s*(?:sales\s*)?tax/i);
  if (tax) out.taxPct = parseFloat(tax[1]);

  return out;
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function dedupeDayparts(list: DaypartMinimum[]) {
  const seen = new Set<string>();
  return list.filter((d) => {
    const k = `${d.label}|${d.amountCents}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Parse "36-40", "36 (Terrace) | 25 (Lounge)", "65-90 (reception); 45 (Terrace)". */
export function parseCapacityText(text: string | null | undefined): { max: number | null; min: number | null; configurations: { name: string; value: number }[] } {
  if (!text?.trim()) return { max: null, min: null, configurations: [] };
  const configurations: { name: string; value: number }[] = [];
  for (const m of text.matchAll(/(\d{1,4})(?:\s*[-–]\s*(\d{1,4}))?\s*\(([^)]+)\)/g)) {
    configurations.push({ name: m[3].trim(), value: parseInt(m[2] ?? m[1], 10) });
  }
  const nums = Array.from(text.matchAll(/\d{1,4}/g)).map((m) => parseInt(m[0], 10));
  if (!nums.length) return { max: null, min: null, configurations };
  const range = text.match(/^\s*(\d{1,4})\s*[-–]\s*(\d{1,4})\s*$/);
  return { max: Math.max(...nums), min: range ? parseInt(range[1], 10) : null, configurations };
}
