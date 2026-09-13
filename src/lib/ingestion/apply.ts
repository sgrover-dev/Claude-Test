import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { completenessScore } from "@/lib/inventory/quality";
import { slugify, uniqueSlug } from "@/lib/slug";
import type { InventoryPayload, ProvenanceInput, SpacePayload } from "./types";

const { restaurants, locations, spaces, spacePhotos, documents, factSources, neighborhoods } = schema;

export type ApplyOptions = {
  cityId: string;
  createdByUserId?: string | null;
  /** Provenance to attach to every record when the payload has none (e.g. CSV import job). */
  defaultProvenance?: ProvenanceInput | null;
  /** When true, never overwrite an existing non-null value with a new one. */
  preserveExisting?: boolean;
  status?: "draft" | "active";
};

export type ApplyResult = {
  restaurantId: string;
  locationId: string;
  spaceIds: string[];
  created: { restaurant: boolean; location: boolean; spaces: number };
  updated: { spaces: number };
};

function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export async function applyInventoryPayload(payload: InventoryPayload, opts: ApplyOptions): Promise<ApplyResult> {
  const result: ApplyResult = { restaurantId: "", locationId: "", spaceIds: [], created: { restaurant: false, location: false, spaces: 0 }, updated: { spaces: 0 } };
  const r = payload.restaurant;
  const status = opts.status ?? "active";

  // Restaurant ----------------------------------------------------------
  const baseSlug = slugify(r.name);
  let restaurant = await db.query.restaurants.findFirst({ where: eq(restaurants.slug, baseSlug) });
  const restaurantValues = compact({
    name: r.name,
    description: r.description ?? undefined,
    cuisines: r.cuisines?.length ? r.cuisines : undefined,
    priceTier: r.priceTier ?? undefined,
    websiteUrl: r.websiteUrl ?? undefined,
    eventsPageUrl: r.eventsPageUrl ?? undefined,
    phone: r.phone ?? undefined,
    eventsContactName: r.eventsContactName ?? undefined,
    eventsContactEmail: r.eventsContactEmail ?? undefined,
    eventsContactPhone: r.eventsContactPhone ?? undefined,
    contactVerifiedAt: r.contactVerifiedAt ?? undefined,
    internalNotes: r.internalNotes ?? undefined,
  });
  if (!restaurant) {
    const taken = new Set((await db.select({ slug: restaurants.slug }).from(restaurants)).map((x) => x.slug));
    [restaurant] = await db.insert(restaurants).values({ ...restaurantValues, name: r.name, slug: uniqueSlug(r.name, taken), status }).returning();
    result.created.restaurant = true;
  } else {
    const patch = opts.preserveExisting ? Object.fromEntries(Object.entries(restaurantValues).filter(([k]) => (restaurant as Record<string, unknown>)[k] == null || (Array.isArray((restaurant as Record<string, unknown>)[k]) && ((restaurant as Record<string, unknown>)[k] as unknown[]).length === 0))) : restaurantValues;
    if (Object.keys(patch).length) [restaurant] = await db.update(restaurants).set({ ...patch, updatedAt: new Date() }).where(eq(restaurants.id, restaurant.id)).returning();
  }
  result.restaurantId = restaurant.id;
  await upsertProvenance("restaurant", restaurant.id, r.provenance ?? (opts.defaultProvenance ? [opts.defaultProvenance] : []), opts.createdByUserId);
  for (const d of r.documents ?? []) await upsertDocument("restaurant", restaurant.id, d);

  // Location ------------------------------------------------------------
  const l = payload.location;
  const neighborhood = l.neighborhoodSlug ? await db.query.neighborhoods.findFirst({ where: and(eq(neighborhoods.cityId, opts.cityId), eq(neighborhoods.slug, l.neighborhoodSlug)) }) : null;
  const existingLocations = await db.query.locations.findMany({ where: eq(locations.restaurantId, restaurant.id) });
  let location =
    (l.addressLine1 ? existingLocations.find((x) => x.addressLine1?.toLowerCase() === l.addressLine1!.toLowerCase()) : undefined) ??
    (existingLocations.length === 1 ? existingLocations[0] : undefined) ??
    (l.name ? existingLocations.find((x) => x.name?.toLowerCase() === l.name!.toLowerCase()) : undefined);
  const centroid = neighborhood && neighborhood.lat && neighborhood.lng ? { lat: neighborhood.lat, lng: neighborhood.lng } : null;
  const locationValues = compact({
    neighborhoodId: neighborhood?.id ?? undefined,
    name: l.name ?? undefined,
    addressLine1: l.addressLine1 ?? undefined,
    addressLine2: l.addressLine2 ?? undefined,
    cityName: l.cityName ?? undefined,
    state: l.state ?? undefined,
    postalCode: l.postalCode ?? undefined,
    lat: l.lat != null ? String(l.lat) : undefined,
    lng: l.lng != null ? String(l.lng) : undefined,
    hasValet: l.hasValet ?? undefined,
    hasParkingLot: l.hasParkingLot ?? undefined,
    isWheelchairAccessible: l.isWheelchairAccessible ?? undefined,
    parkingNotes: l.parkingNotes ?? undefined,
  });
  let usedCentroid = false;
  if (!location) {
    const slugBase = l.name ?? neighborhood?.slug ?? l.addressLine1 ?? "main";
    const taken = new Set(existingLocations.map((x) => x.slug));
    const values = { ...locationValues, restaurantId: restaurant.id, cityId: opts.cityId, slug: uniqueSlug(slugBase, taken), status };
    if (values.lat == null && centroid) {
      values.lat = centroid.lat;
      values.lng = centroid.lng;
      usedCentroid = true;
    }
    [location] = await db.insert(locations).values(values).returning();
    result.created.location = true;
  } else {
    const patch: Record<string, unknown> = opts.preserveExisting ? Object.fromEntries(Object.entries(locationValues).filter(([k]) => (location as Record<string, unknown>)[k] == null)) : locationValues;
    if (location.lat == null && locationValues.lat == null && centroid) {
      patch.lat = centroid.lat;
      patch.lng = centroid.lng;
      usedCentroid = true;
    }
    if (Object.keys(patch).length) [location] = await db.update(locations).set({ ...patch, updatedAt: new Date() }).where(eq(locations.id, location.id)).returning();
  }
  result.locationId = location.id;
  if (usedCentroid) {
    await upsertProvenance("location", location.id, [{ sourceType: "red_rope_research", confidence: "estimate", fields: ["lat", "lng"], note: `Neighborhood centroid (${neighborhood?.name}); exact geocode pending.` }], opts.createdByUserId);
  }

  // Spaces --------------------------------------------------------------
  const existingSpaces = await db.query.spaces.findMany({ where: eq(spaces.locationId, location.id) });
  const takenSlugs = new Set((await db.select({ slug: spaces.slug }).from(spaces)).map((x) => x.slug));
  const hasContact = !!(restaurant.eventsContactEmail || restaurant.eventsContactPhone || restaurant.phone);
  for (const s of payload.spaces) {
    const existing = existingSpaces.find((x) => x.name.toLowerCase() === s.name.toLowerCase());
    const values = spaceValues(s);
    let row: schema.Space;
    if (!existing) {
      const slug = uniqueSlug(`${restaurant.name} ${s.name}`, takenSlugs);
      [row] = await db.insert(spaces).values({ ...values, name: s.name, locationId: location.id, slug, status, completenessScore: 0 }).returning();
      result.created.spaces++;
    } else {
      const patch = opts.preserveExisting ? Object.fromEntries(Object.entries(values).filter(([k]) => { const cur = (existing as Record<string, unknown>)[k]; return cur == null || (Array.isArray(cur) && cur.length === 0); })) : values;
      [row] = await db.update(spaces).set({ ...patch, updatedAt: new Date() }).where(eq(spaces.id, existing.id)).returning();
      result.updated.spaces++;
    }
    for (const [i, p] of (s.photos ?? []).entries()) {
      const dup = await db.query.spacePhotos.findFirst({ where: and(eq(spacePhotos.spaceId, row.id), eq(spacePhotos.url, p.url)) });
      if (!dup) await db.insert(spacePhotos).values({ spaceId: row.id, url: p.url, alt: p.alt ?? null, sortOrder: i });
    }
    for (const d of s.documents ?? []) await upsertDocument("space", row.id, d);
    await upsertProvenance("space", row.id, s.provenance ?? (opts.defaultProvenance ? [opts.defaultProvenance] : []), opts.createdByUserId);
    await recomputeCompleteness(row.id, hasContact);
    result.spaceIds.push(row.id);
  }
  return result;
}

function spaceValues(s: SpacePayload) {
  return compact({
    description: s.description ?? undefined,
    spaceType: s.spaceType ?? undefined,
    privacy: s.privacy ?? undefined,
    indoorOutdoor: s.indoorOutdoor ?? undefined,
    minGuests: s.minGuests ?? undefined,
    maxSeated: s.maxSeated ?? undefined,
    maxStanding: s.maxStanding ?? undefined,
    configurations: s.configurations?.length ? s.configurations : undefined,
    roomFeeCents: s.roomFeeCents ?? undefined,
    fbMinimumCents: s.fbMinimumCents ?? undefined,
    estPerPersonLowCents: s.estPerPersonLowCents ?? undefined,
    estPerPersonHighCents: s.estPerPersonHighCents ?? undefined,
    daypartMinimums: s.daypartMinimums?.length ? s.daypartMinimums : undefined,
    depositCents: s.depositCents ?? undefined,
    serviceChargePct: s.serviceChargePct != null ? String(s.serviceChargePct) : undefined,
    adminFeePct: s.adminFeePct != null ? String(s.adminFeePct) : undefined,
    taxPct: s.taxPct != null ? String(s.taxPct) : undefined,
    cancellationPolicy: s.cancellationPolicy ?? undefined,
    pricingNotes: s.pricingNotes ?? undefined,
    amenities: s.amenities?.length ? s.amenities : undefined,
    foodStyles: s.foodStyles?.length ? s.foodStyles : undefined,
    ambiance: s.ambiance?.length ? s.ambiance : undefined,
    suitableFor: s.suitableFor?.length ? s.suitableFor : undefined,
    availabilityNotes: s.availabilityNotes ?? undefined,
    maxDurationMinutes: s.maxDurationMinutes ?? undefined,
    outsideCakePolicy: s.outsideCakePolicy ?? undefined,
    featureNotes: s.featureNotes ?? undefined,
    researchNotes: s.researchNotes ?? undefined,
    verificationStatus: s.verificationStatus ?? undefined,
    lastVerifiedAt: s.lastVerifiedAt ?? undefined,
  });
}

export async function recomputeCompleteness(spaceId: string, hasContact?: boolean) {
  const space = await db.query.spaces.findFirst({ where: eq(spaces.id, spaceId), with: { location: { with: { restaurant: true } } } });
  if (!space) return;
  const [{ photoCount }] = await db.select({ photoCount: sql<number>`count(*)::int` }).from(spacePhotos).where(eq(spacePhotos.spaceId, spaceId));
  const r = space.location.restaurant;
  const score = completenessScore({ ...space, photoCount: Number(photoCount), hasContact: hasContact ?? !!(r.eventsContactEmail || r.eventsContactPhone || r.phone) });
  await db.update(spaces).set({ completenessScore: score }).where(eq(spaces.id, spaceId));
  return score;
}

async function upsertDocument(entityType: string, entityId: string, d: { title: string; url: string; kind?: "menu" | "private_dining_packet" | "contract" | "floor_plan" | "other" }) {
  const dup = await db.query.documents.findFirst({ where: and(eq(documents.entityType, entityType), eq(documents.entityId, entityId), eq(documents.url, d.url)) });
  if (dup) return;
  await db.insert(documents).values({ entityType, entityId, title: d.title, url: d.url, kind: d.kind ?? "other", mimeType: /\.pdf(\?|$)/i.test(d.url) ? "application/pdf" : null });
}

export async function upsertProvenance(entityType: string, entityId: string, rows: ProvenanceInput[], createdByUserId?: string | null) {
  for (const p of rows) {
    const fields = p.fields?.length ? p.fields : [null];
    for (const field of fields) {
      const dup = await db.query.factSources.findFirst({
        where: and(
          eq(factSources.entityType, entityType),
          eq(factSources.entityId, entityId),
          eq(factSources.sourceType, p.sourceType),
          p.sourceUrl ? eq(factSources.sourceUrl, p.sourceUrl) : sql`${factSources.sourceUrl} is null`,
          field ? eq(factSources.field, field) : sql`${factSources.field} is null`,
          eq(factSources.confidence, p.confidence),
        ),
      });
      if (dup) continue;
      await db.insert(factSources).values({
        entityType,
        entityId,
        field,
        sourceType: p.sourceType,
        sourceUrl: p.sourceUrl ?? null,
        confidence: p.confidence,
        note: p.note ?? null,
        extractedAt: p.extractedAt ?? new Date(),
        verifiedAt: p.verifiedAt ?? (p.confidence === "verified" ? new Date() : null),
        verificationMethod: p.confidence === "verified" ? p.sourceType : null,
        createdByUserId: createdByUserId ?? null,
      });
    }
  }
}
