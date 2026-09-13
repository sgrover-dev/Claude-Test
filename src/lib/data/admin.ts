import "server-only";
import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { STALE_AFTER_DAYS, normalizeNameForDedupe } from "@/lib/inventory/quality";

const { spaces, locations, restaurants, neighborhoods, spacePhotos, inquiries, inquiryCandidates, ingestionJobs, extractionCandidates } = schema;

export async function inventoryStats() {
  const stale = sql`(${spaces.lastVerifiedAt} is null or ${spaces.lastVerifiedAt} < now() - interval '${sql.raw(String(STALE_AFTER_DAYS))} days')`;
  const active = and(eq(spaces.status, "active"), isNull(spaces.mergedIntoSpaceId));
  const [s] = await db
    .select({
      totalSpaces: sql<number>`count(*)::int`,
      withCapacity: sql<number>`count(*) filter (where ${spaces.maxSeated} is not null or ${spaces.maxStanding} is not null)::int`,
      withPricing: sql<number>`count(*) filter (where ${spaces.fbMinimumCents} is not null or ${spaces.estPerPersonLowCents} is not null or ${spaces.roomFeeCents} is not null)::int`,
      withPhotos: sql<number>`count(*) filter (where exists (select 1 from space_photos p where p.space_id = "spaces"."id"))::int`,
      withPrivacy: sql<number>`count(*) filter (where ${spaces.privacy} is not null)::int`,
      verified: sql<number>`count(*) filter (where ${spaces.verificationStatus} = 'verified')::int`,
      verified90: sql<number>`count(*) filter (where ${spaces.lastVerifiedAt} >= now() - interval '90 days')::int`,
      stale: sql<number>`count(*) filter (where ${stale})::int`,
      incomplete: sql<number>`count(*) filter (where ${spaces.completenessScore} < 60)::int`,
      avgCompleteness: sql<number>`coalesce(round(avg(${spaces.completenessScore})), 0)::int`,
    })
    .from(spaces)
    .where(active);
  const [r] = await db
    .select({
      totalRestaurants: sql<number>`count(*)::int`,
      withContact: sql<number>`count(*) filter (where ${restaurants.eventsContactEmail} is not null or ${restaurants.eventsContactPhone} is not null)::int`,
      contactVerified: sql<number>`count(*) filter (where ${restaurants.contactVerifiedAt} is not null)::int`,
      claimed: sql<number>`count(*) filter (where ${restaurants.claimedAt} is not null)::int`,
    })
    .from(restaurants)
    .where(eq(restaurants.status, "active"));
  const [l] = await db.select({ totalLocations: sql<number>`count(*)::int`, geocoded: sql<number>`count(*) filter (where ${locations.lat} is not null)::int` }).from(locations).where(eq(locations.status, "active"));
  const [i] = await db
    .select({
      active: sql<number>`count(*) filter (where ${inquiries.status} not in ('closed','cancelled','draft'))::int`,
      awaitingVenue: sql<number>`count(*) filter (where ${inquiries.status} in ('contacting_venues','awaiting_venue'))::int`,
      needsCustomer: sql<number>`count(*) filter (where ${inquiries.status} in ('options_available','customer_reviewing','deposit_required'))::int`,
      booked30: sql<number>`count(*) filter (where ${inquiries.status} = 'booked' and ${inquiries.updatedAt} > now() - interval '30 days')::int`,
      new7: sql<number>`count(*) filter (where ${inquiries.createdAt} > now() - interval '7 days')::int`,
    })
    .from(inquiries);
  const [f] = await db.select({ followUps: sql<number>`count(*)::int` }).from(inquiryCandidates).where(or(eq(inquiryCandidates.status, "follow_up_due"), and(eq(inquiryCandidates.status, "contacted"), sql`${inquiryCandidates.lastContactAt} < now() - interval '48 hours'`))!);
  const [q] = await db.select({ pendingReview: sql<number>`count(*)::int` }).from(extractionCandidates).where(eq(extractionCandidates.status, "pending"));
  const [v] = await db.select({ views30: sql<number>`count(*)::int` }).from(schema.spaceViews).where(sql`${schema.spaceViews.createdAt} > now() - interval '30 days'`);
  return { ...s, ...r, ...l, ...i, ...f, ...q, ...v };
}

export type SpaceListFilter = { q?: string; missing?: string; stale?: boolean; status?: string; verification?: string; restaurantId?: string; sort?: string; page?: number };

export async function listSpacesForAdmin(f: SpaceListFilter) {
  const conds = [];
  if (f.q) conds.push(or(ilike(spaces.name, `%${f.q}%`), ilike(restaurants.name, `%${f.q}%`))!);
  if (f.status) conds.push(eq(spaces.status, f.status as "active"));
  else conds.push(sql`${spaces.status} <> 'archived'`);
  if (f.verification) conds.push(eq(spaces.verificationStatus, f.verification as "verified"));
  if (f.restaurantId) conds.push(eq(restaurants.id, f.restaurantId));
  if (f.stale) conds.push(sql`(${spaces.lastVerifiedAt} is null or ${spaces.lastVerifiedAt} < now() - interval '${sql.raw(String(STALE_AFTER_DAYS))} days')`);
  switch (f.missing) {
    case "capacity": conds.push(and(isNull(spaces.maxSeated), isNull(spaces.maxStanding))!); break;
    case "pricing": conds.push(and(isNull(spaces.fbMinimumCents), isNull(spaces.estPerPersonLowCents), isNull(spaces.roomFeeCents))!); break;
    case "photos": conds.push(sql`not exists (select 1 from space_photos p where p.space_id = ${spaces.id})`); break;
    case "privacy": conds.push(isNull(spaces.privacy)); break;
    case "contact": conds.push(and(isNull(restaurants.eventsContactEmail), isNull(restaurants.eventsContactPhone))!); break;
    case "description": conds.push(or(isNull(spaces.description), sql`length(${spaces.description}) < 40`)!); break;
    case "amenities": conds.push(sql`cardinality(${spaces.amenities}) = 0`); break;
  }
  const order = f.sort === "name" ? asc(spaces.name) : f.sort === "verified" ? asc(spaces.lastVerifiedAt) : f.sort === "completeness_desc" ? desc(spaces.completenessScore) : f.sort === "updated" ? desc(spaces.updatedAt) : asc(spaces.completenessScore);
  const page = Math.max(1, f.page ?? 1);
  const pageSize = 50;
  const rows = await db
    .select({
      id: spaces.id,
      slug: spaces.slug,
      name: spaces.name,
      spaceType: spaces.spaceType,
      privacy: spaces.privacy,
      maxSeated: spaces.maxSeated,
      maxStanding: spaces.maxStanding,
      fbMinimumCents: spaces.fbMinimumCents,
      estPerPersonLowCents: spaces.estPerPersonLowCents,
      roomFeeCents: spaces.roomFeeCents,
      verificationStatus: spaces.verificationStatus,
      lastVerifiedAt: spaces.lastVerifiedAt,
      completenessScore: spaces.completenessScore,
      status: spaces.status,
      updatedAt: spaces.updatedAt,
      restaurantName: restaurants.name,
      restaurantId: restaurants.id,
      neighborhoodName: neighborhoods.name,
      photoCount: sql<number>`(select count(*)::int from space_photos p where p.space_id = ${spaces.id})`,
      total: sql<number>`count(*) over()::int`,
    })
    .from(spaces)
    .innerJoin(locations, eq(locations.id, spaces.locationId))
    .innerJoin(restaurants, eq(restaurants.id, locations.restaurantId))
    .leftJoin(neighborhoods, eq(neighborhoods.id, locations.neighborhoodId))
    .where(and(...conds))
    .orderBy(order, asc(spaces.name))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { rows, total: rows[0]?.total ?? 0, page, pageSize };
}

export async function listRestaurantsForAdmin(q?: string) {
  return db
    .select({
      id: restaurants.id,
      slug: restaurants.slug,
      name: restaurants.name,
      status: restaurants.status,
      cuisines: restaurants.cuisines,
      eventsContactEmail: restaurants.eventsContactEmail,
      eventsContactPhone: restaurants.eventsContactPhone,
      contactVerifiedAt: restaurants.contactVerifiedAt,
      claimedAt: restaurants.claimedAt,
      updatedAt: restaurants.updatedAt,
      locationCount: sql<number>`(select count(*)::int from locations l where l.restaurant_id = "restaurants"."id")`,
      spaceCount: sql<number>`(select count(*)::int from spaces s join locations l on l.id = s.location_id where l.restaurant_id = "restaurants"."id" and s.status <> 'archived')`,
      neighborhood: sql<string | null>`(select n.name from locations l left join neighborhoods n on n.id = l.neighborhood_id where l.restaurant_id = "restaurants"."id" order by l.created_at limit 1)`,
    })
    .from(restaurants)
    .where(q ? ilike(restaurants.name, `%${q}%`) : undefined)
    .orderBy(asc(restaurants.name))
    .limit(300);
}

export async function getRestaurantForAdmin(id: string) {
  const r = await db.query.restaurants.findFirst({
    where: eq(restaurants.id, id),
    with: { locations: { with: { neighborhood: true, spaces: { with: { photos: true } } } } },
  });
  if (!r) return null;
  const [docs, provenance] = await Promise.all([
    db.query.documents.findMany({ where: and(eq(schema.documents.entityType, "restaurant"), eq(schema.documents.entityId, id)) }),
    db.query.factSources.findMany({ where: and(eq(schema.factSources.entityType, "restaurant"), eq(schema.factSources.entityId, id)), orderBy: desc(schema.factSources.createdAt) }),
  ]);
  return { ...r, documents: docs, provenance };
}

export async function getSpaceForAdmin(id: string) {
  const s = await db.query.spaces.findFirst({
    where: eq(spaces.id, id),
    with: { photos: { orderBy: asc(spacePhotos.sortOrder) }, availabilityRules: true, location: { with: { restaurant: true, neighborhood: true, city: true } } },
  });
  if (!s) return null;
  const [docs, provenance, hoods] = await Promise.all([
    db.query.documents.findMany({ where: and(eq(schema.documents.entityType, "space"), eq(schema.documents.entityId, id)) }),
    db.query.factSources.findMany({ where: and(eq(schema.factSources.entityType, "space"), eq(schema.factSources.entityId, id)), orderBy: desc(schema.factSources.createdAt) }),
    db.query.neighborhoods.findMany({ where: eq(neighborhoods.cityId, s.location.cityId), orderBy: asc(neighborhoods.name) }),
  ]);
  return { ...s, documents: docs, provenance, neighborhoods: hoods };
}

/** Potential duplicates: same location with near-identical normalized names, or restaurants with the same normalized name. */
export async function findDuplicates() {
  const rows = await db
    .select({ id: spaces.id, name: spaces.name, locationId: spaces.locationId, restaurantName: restaurants.name, slug: spaces.slug, completeness: spaces.completenessScore })
    .from(spaces)
    .innerJoin(locations, eq(locations.id, spaces.locationId))
    .innerJoin(restaurants, eq(restaurants.id, locations.restaurantId))
    .where(and(sql`${spaces.status} <> 'archived'`, isNull(spaces.mergedIntoSpaceId)));
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.locationId}|${normalizeNameForDedupe(r.name)}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const spaceDupes = Array.from(groups.values()).filter((g) => g.length > 1);
  const rs = await db.select({ id: restaurants.id, name: restaurants.name, slug: restaurants.slug }).from(restaurants).where(sql`${restaurants.status} <> 'archived'`);
  const rGroups = new Map<string, typeof rs>();
  for (const r of rs) {
    const key = r.name.toLowerCase().replace(/\b(the|restaurant|houston|steakhouse|&|and)\b/g, "").replace(/[^a-z0-9]/g, "");
    rGroups.set(key, [...(rGroups.get(key) ?? []), r]);
  }
  const restaurantDupes = Array.from(rGroups.values()).filter((g) => g.length > 1);
  return { spaceDupes, restaurantDupes };
}

export async function recentJobs(limit = 8) {
  return db.query.ingestionJobs.findMany({ orderBy: [desc(ingestionJobs.createdAt)], limit });
}

export async function searchSpacesByName(q: string, limit = 10) {
  return db
    .select({ id: spaces.id, name: spaces.name, restaurantName: restaurants.name, slug: spaces.slug, maxSeated: spaces.maxSeated })
    .from(spaces)
    .innerJoin(locations, eq(locations.id, spaces.locationId))
    .innerJoin(restaurants, eq(restaurants.id, locations.restaurantId))
    .where(and(eq(spaces.status, "active"), or(ilike(spaces.name, `%${q}%`), ilike(restaurants.name, `%${q}%`))))
    .orderBy(asc(restaurants.name))
    .limit(limit);
}

export async function listOpsUsers() {
  return db.query.users.findMany({ where: or(eq(schema.users.role, "ops"), eq(schema.users.role, "admin")), orderBy: asc(schema.users.email) });
}
