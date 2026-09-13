import "server-only";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/db";
import { toLatLng } from "@/lib/geo";
import { rankSpaces, type RankableSpace, type RankedSpace } from "@/lib/search/rank";
import type { SearchFilters } from "@/lib/search/types";
import { OCCASION_PAGES } from "@/lib/taxonomy";
import { cityDefaultTaxPct, getCityBySlug, listNeighborhoods } from "./cities";

const { spaces, locations, restaurants, neighborhoods, spacePhotos, cities } = schema;

/** The card-level shape used across search, compare, saved and admin lists. */
export type SpaceSummary = RankableSpace & {
  slug: string;
  restaurantSlug: string;
  restaurantId: string;
  locationId: string;
  neighborhoodName: string | null;
  addressLine1: string | null;
  photoUrl: string | null;
  lastVerifiedAt: Date | null;
  availabilityMode: string;
  priceTier: number | null;
  status: string;
};

const summarySelect = {
  id: spaces.id,
  slug: spaces.slug,
  name: spaces.name,
  description: spaces.description,
  privacy: spaces.privacy,
  spaceType: spaces.spaceType,
  indoorOutdoor: spaces.indoorOutdoor,
  minGuests: spaces.minGuests,
  maxSeated: spaces.maxSeated,
  maxStanding: spaces.maxStanding,
  fbMinimumCents: spaces.fbMinimumCents,
  roomFeeCents: spaces.roomFeeCents,
  estPerPersonLowCents: spaces.estPerPersonLowCents,
  estPerPersonHighCents: spaces.estPerPersonHighCents,
  serviceChargePct: spaces.serviceChargePct,
  taxPct: spaces.taxPct,
  depositCents: spaces.depositCents,
  amenities: spaces.amenities,
  foodStyles: spaces.foodStyles,
  ambiance: spaces.ambiance,
  suitableFor: spaces.suitableFor,
  verificationStatus: spaces.verificationStatus,
  completenessScore: spaces.completenessScore,
  lastVerifiedAt: spaces.lastVerifiedAt,
  availabilityMode: spaces.availabilityMode,
  status: spaces.status,
  locationId: locations.id,
  lat: locations.lat,
  lng: locations.lng,
  addressLine1: locations.addressLine1,
  isWheelchairAccessible: locations.isWheelchairAccessible,
  hasValet: locations.hasValet,
  hasParkingLot: locations.hasParkingLot,
  restaurantId: restaurants.id,
  restaurantName: restaurants.name,
  restaurantSlug: restaurants.slug,
  cuisines: restaurants.cuisines,
  priceTier: restaurants.priceTier,
  neighborhoodSlug: neighborhoods.slug,
  neighborhoodName: neighborhoods.name,
  photoUrl: sql<string | null>`(select url from space_photos p where p.space_id = ${spaces.id} order by p.sort_order asc limit 1)`,
  photoCount: sql<number>`(select count(*)::int from space_photos p where p.space_id = ${spaces.id})`,
};

function toSummary(r: Record<string, unknown>): SpaceSummary {
  const row = r as Omit<SpaceSummary, "latLng"> & { lat: string | null; lng: string | null };
  return { ...row, latLng: toLatLng(row.lat, row.lng), photoCount: Number(row.photoCount ?? 0) };
}

function baseQuery() {
  return db
    .select(summarySelect)
    .from(spaces)
    .innerJoin(locations, eq(locations.id, spaces.locationId))
    .innerJoin(restaurants, eq(restaurants.id, locations.restaurantId))
    .leftJoin(neighborhoods, eq(neighborhoods.id, locations.neighborhoodId));
}

const activeOnly = () => and(eq(spaces.status, "active"), isNull(spaces.mergedIntoSpaceId), eq(restaurants.status, "active"), eq(locations.status, "active"));

export const PAGE_SIZE = 24;

export type SearchResult = {
  results: RankedSpace<SpaceSummary>[];
  /** When a neighborhood is requested: matching spaces outside it, by score. */
  nearby: RankedSpace<SpaceSummary>[];
  total: number;
  page: number;
  pageCount: number;
  city: schema.City;
  neighborhood: schema.Neighborhood | null;
};

export async function searchSpaces(f: SearchFilters): Promise<SearchResult | null> {
  const city = await getCityBySlug(f.city);
  if (!city) return null;
  const hoods = await listNeighborhoods(city.id);
  const neighborhood = f.neighborhood ? hoods.find((h) => h.slug === f.neighborhood) ?? null : null;

  const conditions = [activeOnly(), eq(locations.cityId, city.id)];
  if (f.guests) {
    const g = f.guests;
    // Keep spaces whose max (seated or standing) can plausibly hold the group, or whose capacity is unknown.
    conditions.push(
      or(
        and(isNull(spaces.maxSeated), isNull(spaces.maxStanding)),
        sql`${spaces.maxSeated} * 1.1 >= ${g}`,
        sql`${spaces.maxStanding} * 1.1 >= ${g}`,
      )!,
    );
  }
  const rows = await baseQuery().where(and(...conditions));
  const origin = neighborhood ? toLatLng(neighborhood.lat, neighborhood.lng) : null;
  const rankedAll = rankSpaces(rows.map(toSummary), f, { origin, defaultTaxPct: cityDefaultTaxPct(city.slug) });
  const ranked = neighborhood ? rankedAll.filter((r) => r.space.neighborhoodSlug === neighborhood.slug) : rankedAll;
  const nearby = neighborhood ? rankedAll.filter((r) => r.space.neighborhoodSlug !== neighborhood.slug).slice(0, 12) : [];
  const page = Math.max(1, f.page ?? 1);
  const pageCount = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
  return {
    results: ranked.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    nearby: page === 1 || ranked.length === 0 ? nearby : [],
    total: ranked.length,
    page,
    pageCount,
    city,
    neighborhood,
  };
}

export const getSpaceBySlug = cache(async (slug: string) => {
  const space = await db.query.spaces.findFirst({
    where: eq(spaces.slug, slug),
    with: {
      photos: { orderBy: asc(spacePhotos.sortOrder) },
      availabilityRules: true,
      location: { with: { restaurant: true, neighborhood: true, city: true } },
    },
  });
  if (!space) return null;
  const [provenance, documents, siblings] = await Promise.all([
    db.query.factSources.findMany({ where: and(eq(schema.factSources.entityType, "space"), eq(schema.factSources.entityId, space.id)), orderBy: desc(schema.factSources.createdAt) }),
    db.query.documents.findMany({
      where: or(
        and(eq(schema.documents.entityType, "space"), eq(schema.documents.entityId, space.id)),
        and(eq(schema.documents.entityType, "restaurant"), eq(schema.documents.entityId, space.location.restaurantId)),
      ),
    }),
    baseQuery().where(and(activeOnly(), eq(spaces.locationId, space.locationId), sql`${spaces.id} <> ${space.id}`)),
  ]);
  return { ...space, provenance, documents, siblings: siblings.map(toSummary) };
});

export type SpaceDetail = NonNullable<Awaited<ReturnType<typeof getSpaceBySlug>>>;

export async function listSpacesByIds(ids: string[]): Promise<SpaceSummary[]> {
  if (!ids.length) return [];
  const rows = await baseQuery().where(inArray(spaces.id, ids));
  const map = new Map(rows.map((r) => [r.id, toSummary(r)]));
  return ids.map((id) => map.get(id)).filter((x): x is SpaceSummary => !!x);
}

export async function listSpacesBySlugs(slugs: string[]): Promise<SpaceSummary[]> {
  if (!slugs.length) return [];
  const rows = await baseQuery().where(and(activeOnly(), inArray(spaces.slug, slugs)));
  const map = new Map(rows.map((r) => [r.slug, toSummary(r)]));
  return slugs.map((s) => map.get(s)).filter((x): x is SpaceSummary => !!x);
}

export const getRestaurantBySlug = cache(async (slug: string) => {
  const restaurant = await db.query.restaurants.findFirst({
    where: eq(restaurants.slug, slug),
    with: { locations: { with: { neighborhood: true, city: true } } },
  });
  if (!restaurant) return null;
  const rows = await baseQuery().where(and(activeOnly(), eq(restaurants.id, restaurant.id)));
  return { ...restaurant, spaces: rows.map(toSummary) };
});

/** Spaces for SEO landing pages (neighborhood or occasion). */
export async function listSpacesForLanding(citySlug: string, opts: { neighborhoodSlug?: string; occasionSlug?: string }): Promise<{ city: schema.City; spaces: SpaceSummary[]; neighborhood: schema.Neighborhood | null; occasion: (typeof OCCASION_PAGES)[number] | null } | null> {
  const city = await getCityBySlug(citySlug);
  if (!city) return null;
  const conditions = [activeOnly(), eq(locations.cityId, city.id)];
  let neighborhood: schema.Neighborhood | null = null;
  let occasion: (typeof OCCASION_PAGES)[number] | null = null;
  if (opts.neighborhoodSlug) {
    neighborhood = (await listNeighborhoods(city.id)).find((n) => n.slug === opts.neighborhoodSlug) ?? null;
    if (!neighborhood) return null;
    conditions.push(eq(locations.neighborhoodId, neighborhood.id));
  }
  if (opts.occasionSlug) {
    occasion = OCCASION_PAGES.find((o) => o.slug === opts.occasionSlug) ?? null;
    if (!occasion) return null;
    const parts = [];
    if (occasion.eventTypes.length) parts.push(sql`${spaces.suitableFor} && ${sql.raw(`ARRAY[${occasion.eventTypes.map((e) => `'${e}'`).join(",")}]::text[]`)}`);
    if (occasion.privacy?.length) parts.push(inArray(spaces.privacy, occasion.privacy));
    if (occasion.spaceTypes?.length) parts.push(inArray(spaces.spaceType, occasion.spaceTypes as schema.SpaceType[]));
    if (parts.length) conditions.push(or(...parts)!);
  }
  const rows = await baseQuery().where(and(...conditions)).orderBy(desc(spaces.completenessScore), asc(spaces.name));
  return { city, spaces: rows.map(toSummary), neighborhood, occasion };
}

export async function listAllActiveSpaceSlugs() {
  return db
    .select({ slug: spaces.slug, updatedAt: spaces.updatedAt })
    .from(spaces)
    .innerJoin(locations, eq(locations.id, spaces.locationId))
    .innerJoin(restaurants, eq(restaurants.id, locations.restaurantId))
    .where(activeOnly());
}

export async function listAllActiveRestaurantSlugs() {
  return db.select({ slug: restaurants.slug, updatedAt: restaurants.updatedAt }).from(restaurants).where(eq(restaurants.status, "active"));
}

export async function neighborhoodsWithCounts(cityId: string) {
  return db
    .select({
      id: neighborhoods.id,
      slug: neighborhoods.slug,
      name: neighborhoods.name,
      count: sql<number>`count(${spaces.id})::int`,
    })
    .from(neighborhoods)
    .leftJoin(locations, and(eq(locations.neighborhoodId, neighborhoods.id), eq(locations.status, "active")))
    .leftJoin(spaces, and(eq(spaces.locationId, locations.id), eq(spaces.status, "active"), isNull(spaces.mergedIntoSpaceId)))
    .where(eq(neighborhoods.cityId, cityId))
    .groupBy(neighborhoods.id)
    .orderBy(desc(sql`count(${spaces.id})`), asc(neighborhoods.name));
}

export async function featuredSpaces(citySlug: string, limit = 8): Promise<SpaceSummary[]> {
  const rows = await baseQuery()
    .innerJoin(cities, eq(cities.id, locations.cityId))
    .where(and(activeOnly(), eq(cities.slug, citySlug)))
    .orderBy(desc(spaces.verificationStatus), desc(spaces.completenessScore))
    .limit(limit);
  return rows.map(toSummary);
}

export async function recordSpaceView(spaceId: string, opts: { userId?: string | null; visitorId?: string | null; referrer?: string | null }) {
  await db.insert(schema.spaceViews).values({ spaceId, userId: opts.userId ?? null, visitorId: opts.visitorId ?? null, referrer: opts.referrer ?? null });
}
