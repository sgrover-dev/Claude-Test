import { z } from "zod";
import { DEFAULT_CITY, type SearchFilters } from "./types";

const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined));
const bool = z
  .string()
  .optional()
  .transform((v) => (v === "1" || v === "true" ? true : undefined));
const int = z
  .string()
  .optional()
  .transform((v) => {
    if (!v) return undefined;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  });

const schema = z.object({
  city: z.string().optional(),
  neighborhood: z.string().optional(),
  q: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional().catch(undefined),
  guests: int,
  event: z.string().optional(),
  budget: int, // dollars in URL
  budgetPer: bool,
  privacy: csv,
  cuisine: csv,
  ambiance: csv,
  food: csv,
  setting: csv,
  amenities: csv,
  av: bool,
  display: bool,
  accessible: bool,
  parking: bool,
  alcohol: bool,
  privateBar: bool,
  format: z.enum(["seated", "standing"]).optional().catch(undefined),
  duration: int,
  maxMin: int, // dollars in URL
  type: csv,
  sort: z.enum(["relevance", "price_asc", "price_desc", "capacity"]).optional().catch(undefined),
  page: int,
});

export type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseSearchParams(raw: RawSearchParams): SearchFilters {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) flat[k] = Array.isArray(v) ? v[0] : v;
  const p = schema.parse(flat);
  return {
    city: p.city || DEFAULT_CITY,
    neighborhood: p.neighborhood || undefined,
    q: p.q?.trim() || undefined,
    date: p.date,
    startTime: p.time,
    guests: p.guests,
    eventType: p.event || undefined,
    budgetCents: p.budget ? p.budget * 100 : undefined,
    budgetPerPerson: p.budgetPer,
    privacy: p.privacy as SearchFilters["privacy"],
    cuisines: p.cuisine,
    ambiance: p.ambiance,
    foodStyles: p.food,
    indoorOutdoor: p.setting as SearchFilters["indoorOutdoor"],
    amenities: p.amenities,
    avRequired: p.av,
    displayRequired: p.display,
    accessible: p.accessible,
    parking: p.parking,
    alcohol: p.alcohol,
    privateBar: p.privateBar,
    format: p.format,
    durationMinutes: p.duration,
    maxMinimumCents: p.maxMin ? p.maxMin * 100 : undefined,
    spaceTypes: p.type,
    sort: p.sort ?? "relevance",
    page: p.page ?? 1,
  };
}

/** Inverse of parseSearchParams — builds a canonical query string. */
export function searchFiltersToParams(f: Partial<SearchFilters>): URLSearchParams {
  const p = new URLSearchParams();
  const set = (k: string, v: unknown) => {
    if (v === undefined || v === null || v === "" || v === false) return;
    if (Array.isArray(v)) {
      if (v.length) p.set(k, v.join(","));
      return;
    }
    p.set(k, String(v === true ? 1 : v));
  };
  if (f.city && f.city !== DEFAULT_CITY) set("city", f.city);
  set("neighborhood", f.neighborhood);
  set("q", f.q);
  set("date", f.date);
  set("time", f.startTime);
  set("guests", f.guests);
  set("event", f.eventType);
  set("budget", f.budgetCents ? Math.round(f.budgetCents / 100) : undefined);
  set("budgetPer", f.budgetPerPerson);
  set("privacy", f.privacy);
  set("cuisine", f.cuisines);
  set("ambiance", f.ambiance);
  set("food", f.foodStyles);
  set("setting", f.indoorOutdoor);
  set("amenities", f.amenities);
  set("av", f.avRequired);
  set("display", f.displayRequired);
  set("accessible", f.accessible);
  set("parking", f.parking);
  set("alcohol", f.alcohol);
  set("privateBar", f.privateBar);
  set("format", f.format);
  set("duration", f.durationMinutes);
  set("maxMin", f.maxMinimumCents ? Math.round(f.maxMinimumCents / 100) : undefined);
  set("type", f.spaceTypes);
  if (f.sort && f.sort !== "relevance") set("sort", f.sort);
  if (f.page && f.page > 1) set("page", f.page);
  return p;
}

export function searchHref(f: Partial<SearchFilters>): string {
  const qs = searchFiltersToParams(f).toString();
  return qs ? `/search?${qs}` : "/search";
}
