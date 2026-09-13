"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/auth/session";
import { fd, parseConfigurationLines, parseDaypartLines } from "@/lib/forms";
import { recomputeCompleteness, upsertProvenance } from "@/lib/ingestion/apply";
import { slugify, uniqueSlug } from "@/lib/slug";
import { storage } from "@/lib/storage";
import { pdfToText } from "@/lib/ingestion/web";

const { restaurants, locations, spaces, spacePhotos, documents, factSources, availabilityRules } = schema;

/* ----------------------------------------------------------- restaurants */

export async function saveRestaurant(formData: FormData) {
  const user = await requireRole("ops");
  const id = fd.str(formData, "id");
  const values = {
    name: fd.str(formData, "name") ?? "Untitled",
    description: fd.str(formData, "description"),
    cuisines: fd.arr(formData, "cuisines"),
    priceTier: fd.int(formData, "priceTier"),
    websiteUrl: fd.str(formData, "websiteUrl"),
    eventsPageUrl: fd.str(formData, "eventsPageUrl"),
    phone: fd.str(formData, "phone"),
    email: fd.str(formData, "email"),
    eventsContactName: fd.str(formData, "eventsContactName"),
    eventsContactEmail: fd.str(formData, "eventsContactEmail"),
    eventsContactPhone: fd.str(formData, "eventsContactPhone"),
    heroImageUrl: fd.str(formData, "heroImageUrl"),
    internalNotes: fd.str(formData, "internalNotes"),
    status: (fd.str(formData, "status") as "active" | "draft" | "archived" | null) ?? "active",
    updatedAt: new Date(),
  };
  if (fd.bool(formData, "contactVerified")) Object.assign(values, { contactVerifiedAt: new Date() });
  let restaurantId = id;
  if (id) {
    await db.update(restaurants).set(values).where(eq(restaurants.id, id));
  } else {
    const taken = new Set((await db.select({ slug: restaurants.slug }).from(restaurants)).map((r) => r.slug));
    const [row] = await db.insert(restaurants).values({ ...values, slug: uniqueSlug(values.name, taken) }).returning();
    restaurantId = row.id;
    await upsertProvenance("restaurant", row.id, [{ sourceType: "manual_entry", confidence: "unknown", note: `Created by ${user.email}` }], user.id);
  }
  revalidatePath("/admin/restaurants");
  redirect(`/admin/restaurants/${restaurantId}`);
}

export async function saveLocation(formData: FormData) {
  await requireRole("ops");
  const restaurantId = fd.str(formData, "restaurantId")!;
  const id = fd.str(formData, "id");
  const cityId = fd.str(formData, "cityId")!;
  const values = {
    name: fd.str(formData, "name"),
    neighborhoodId: fd.str(formData, "neighborhoodId"),
    addressLine1: fd.str(formData, "addressLine1"),
    addressLine2: fd.str(formData, "addressLine2"),
    cityName: fd.str(formData, "cityName"),
    state: fd.str(formData, "state"),
    postalCode: fd.str(formData, "postalCode"),
    lat: fd.str(formData, "lat"),
    lng: fd.str(formData, "lng"),
    phone: fd.str(formData, "phone"),
    parkingNotes: fd.str(formData, "parkingNotes"),
    hasValet: fd.tri(formData, "hasValet"),
    hasParkingLot: fd.tri(formData, "hasParkingLot"),
    isWheelchairAccessible: fd.tri(formData, "isWheelchairAccessible"),
    updatedAt: new Date(),
  };
  if (id) await db.update(locations).set(values).where(eq(locations.id, id));
  else {
    const existing = await db.query.locations.findMany({ where: eq(locations.restaurantId, restaurantId) });
    const taken = new Set(existing.map((l) => l.slug));
    await db.insert(locations).values({ ...values, restaurantId, cityId, slug: uniqueSlug(values.name ?? values.addressLine1 ?? "main", taken) });
  }
  revalidatePath(`/admin/restaurants/${restaurantId}`);
}

export async function archiveRestaurant(formData: FormData) {
  await requireRole("admin");
  const id = fd.str(formData, "id")!;
  await db.update(restaurants).set({ status: "archived", updatedAt: new Date() }).where(eq(restaurants.id, id));
  revalidatePath("/admin/restaurants");
  redirect("/admin/restaurants");
}

/* ----------------------------------------------------------------- spaces */

function spaceValuesFromForm(formData: FormData) {
  return {
    name: fd.str(formData, "name") ?? "Untitled space",
    description: fd.str(formData, "description"),
    spaceType: (fd.str(formData, "spaceType") as schema.SpaceType | null) ?? "other",
    privacy: fd.str(formData, "privacy") as schema.PrivacyLevel | null,
    indoorOutdoor: fd.str(formData, "indoorOutdoor") as schema.IndoorOutdoor | null,
    minGuests: fd.int(formData, "minGuests"),
    maxSeated: fd.int(formData, "maxSeated"),
    maxStanding: fd.int(formData, "maxStanding"),
    configurations: parseConfigurationLines(fd.lines(formData, "configurations")),
    roomFeeCents: fd.money(formData, "roomFee"),
    fbMinimumCents: fd.money(formData, "fbMinimum"),
    estPerPersonLowCents: fd.money(formData, "perPersonLow"),
    estPerPersonHighCents: fd.money(formData, "perPersonHigh"),
    daypartMinimums: parseDaypartLines(fd.lines(formData, "daypartMinimums")),
    depositCents: fd.money(formData, "deposit"),
    depositNotes: fd.str(formData, "depositNotes"),
    serviceChargePct: fd.pct(formData, "serviceChargePct"),
    adminFeePct: fd.pct(formData, "adminFeePct"),
    taxPct: fd.pct(formData, "taxPct"),
    cancellationPolicy: fd.str(formData, "cancellationPolicy"),
    pricingNotes: fd.str(formData, "pricingNotes"),
    amenities: fd.arr(formData, "amenities"),
    foodStyles: fd.arr(formData, "foodStyles"),
    ambiance: fd.arr(formData, "ambiance"),
    suitableFor: fd.arr(formData, "suitableFor"),
    dietaryAccommodations: fd.str(formData, "dietaryAccommodations"),
    menuNotes: fd.str(formData, "menuNotes"),
    availabilityMode: (fd.str(formData, "availabilityMode") as schema.AvailabilityMode | null) ?? "request",
    availabilityNotes: fd.str(formData, "availabilityNotes"),
    maxDurationMinutes: fd.int(formData, "maxDurationMinutes"),
    ageRestriction: fd.str(formData, "ageRestriction"),
    decorPolicy: fd.str(formData, "decorPolicy"),
    outsideCakePolicy: fd.str(formData, "outsideCakePolicy"),
    outsideVendorPolicy: fd.str(formData, "outsideVendorPolicy"),
    otherRestrictions: fd.str(formData, "otherRestrictions"),
    featureNotes: fd.str(formData, "featureNotes"),
    researchNotes: fd.str(formData, "researchNotes"),
    status: (fd.str(formData, "status") as "active" | "draft" | "archived" | null) ?? "active",
    updatedAt: new Date(),
  };
}

export async function saveSpace(formData: FormData) {
  const user = await requireRole("ops");
  const id = fd.str(formData, "id");
  const locationId = fd.str(formData, "locationId")!;
  const values = spaceValuesFromForm(formData);
  let spaceId = id;
  if (id) {
    await db.update(spaces).set(values).where(eq(spaces.id, id));
  } else {
    const loc = await db.query.locations.findFirst({ where: eq(locations.id, locationId), with: { restaurant: true } });
    if (!loc) throw new Error("Location not found");
    const taken = new Set((await db.select({ slug: spaces.slug }).from(spaces)).map((r) => r.slug));
    const [row] = await db.insert(spaces).values({ ...values, locationId, slug: uniqueSlug(`${loc.restaurant.name} ${values.name}`, taken) }).returning();
    spaceId = row.id;
    await upsertProvenance("space", row.id, [{ sourceType: "manual_entry", confidence: "unknown", note: `Created by ${user.email}` }], user.id);
  }
  // Record the edit as a provenance row so we know a human touched these fields.
  const source = fd.str(formData, "editSourceType") as schema.SourceType | null;
  const sourceUrl = fd.str(formData, "editSourceUrl");
  if (source && spaceId) {
    await upsertProvenance("space", spaceId, [{ sourceType: source, sourceUrl, confidence: (fd.str(formData, "editConfidence") as schema.FactConfidence | null) ?? "publicly_listed", note: fd.str(formData, "editNote") ?? `Edited by ${user.email}` }], user.id);
  }
  await recomputeCompleteness(spaceId!);
  revalidatePath("/admin/spaces");
  revalidatePath(`/admin/spaces/${spaceId}`);
  redirect(`/admin/spaces/${spaceId}?saved=1`);
}

export async function markSpaceVerified(formData: FormData) {
  const user = await requireRole("ops");
  const id = fd.str(formData, "id")!;
  const method = (fd.str(formData, "method") as schema.SourceType | null) ?? "phone_confirmation";
  const note = fd.str(formData, "note");
  const fields = fd.arr(formData, "fields");
  await db.update(spaces).set({ verificationStatus: "verified", lastVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(spaces.id, id));
  await upsertProvenance("space", id, [{ sourceType: method, confidence: "verified", fields: fields.length ? fields : null, note: note ?? `Verified by ${user.email}`, verifiedAt: new Date() }], user.id);
  await recomputeCompleteness(id);
  revalidatePath(`/admin/spaces/${id}`);
}

export async function addProvenance(formData: FormData) {
  const user = await requireRole("ops");
  const entityType = fd.str(formData, "entityType")!;
  const entityId = fd.str(formData, "entityId")!;
  await upsertProvenance(entityType, entityId, [{ sourceType: (fd.str(formData, "sourceType") as schema.SourceType | null) ?? "red_rope_research", sourceUrl: fd.str(formData, "sourceUrl"), confidence: (fd.str(formData, "confidence") as schema.FactConfidence | null) ?? "unknown", fields: fd.arr(formData, "fields"), note: fd.str(formData, "note") }], user.id);
  revalidatePath(entityType === "space" ? `/admin/spaces/${entityId}` : `/admin/restaurants/${entityId}`);
}

export async function deleteProvenance(formData: FormData) {
  await requireRole("ops");
  const id = fd.str(formData, "id")!;
  const back = fd.str(formData, "back") ?? "/admin";
  await db.delete(factSources).where(eq(factSources.id, id));
  revalidatePath(back);
}

export async function addPhoto(formData: FormData) {
  await requireRole("ops");
  const spaceId = fd.str(formData, "spaceId")!;
  const url = fd.str(formData, "url");
  const file = formData.get("file");
  let finalUrl = url;
  if (file instanceof File && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    const stored = await storage.put({ data: buf, filename: file.name, contentType: file.type || "image/jpeg" });
    finalUrl = stored.url;
  }
  if (!finalUrl) return;
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(spacePhotos).where(eq(spacePhotos.spaceId, spaceId));
  await db.insert(spacePhotos).values({ spaceId, url: finalUrl, alt: fd.str(formData, "alt"), sortOrder: Number(n), sourceUrl: fd.str(formData, "sourceUrl") });
  await recomputeCompleteness(spaceId);
  revalidatePath(`/admin/spaces/${spaceId}`);
}

export async function deletePhoto(formData: FormData) {
  await requireRole("ops");
  const id = fd.str(formData, "id")!;
  const spaceId = fd.str(formData, "spaceId")!;
  await db.delete(spacePhotos).where(eq(spacePhotos.id, id));
  await recomputeCompleteness(spaceId);
  revalidatePath(`/admin/spaces/${spaceId}`);
}

export async function addDocument(formData: FormData) {
  await requireRole("ops");
  const entityType = fd.str(formData, "entityType")!;
  const entityId = fd.str(formData, "entityId")!;
  const kind = (fd.str(formData, "kind") as "menu" | "private_dining_packet" | "contract" | "floor_plan" | "other" | null) ?? "other";
  let url = fd.str(formData, "url");
  let extractedText: string | null = null;
  let mimeType: string | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    const stored = await storage.put({ data: buf, filename: file.name, contentType: file.type || "application/octet-stream" });
    url = stored.url;
    mimeType = file.type || null;
    if (/pdf/i.test(file.type) || /\.pdf$/i.test(file.name)) extractedText = await pdfToText(buf).catch(() => null);
  }
  if (!url) return;
  await db.insert(documents).values({ entityType, entityId, kind, title: fd.str(formData, "title") ?? (file instanceof File ? file.name : "Document"), url, mimeType, extractedText });
  revalidatePath(entityType === "space" ? `/admin/spaces/${entityId}` : `/admin/restaurants/${entityId}`);
}

export async function deleteDocument(formData: FormData) {
  await requireRole("ops");
  const id = fd.str(formData, "id")!;
  const back = fd.str(formData, "back") ?? "/admin";
  await db.delete(documents).where(eq(documents.id, id));
  revalidatePath(back);
}

export async function saveAvailabilityRules(formData: FormData) {
  await requireRole("ops");
  const spaceId = fd.str(formData, "spaceId")!;
  const lines = fd.lines(formData, "rules");
  const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const rows: { spaceId: string; dayOfWeek: number; startTime: string | null; endTime: string | null; label: string | null }[] = [];
  for (const line of lines) {
    // "Tue-Thu 17:00-22:00 Dinner" or "Sat 11:00-15:00 Lunch"
    const m = line.match(/^([a-z]{3})(?:\s*[-–]\s*([a-z]{3}))?\s+(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\s*(.*)$/i);
    if (!m) continue;
    const from = DAYS.indexOf(m[1].toLowerCase());
    const to = m[2] ? DAYS.indexOf(m[2].toLowerCase()) : from;
    if (from < 0 || to < 0) continue;
    for (let d = from; ; d = (d + 1) % 7) {
      rows.push({ spaceId, dayOfWeek: d, startTime: m[3], endTime: m[4], label: m[5]?.trim() || null });
      if (d === to) break;
    }
  }
  await db.delete(availabilityRules).where(eq(availabilityRules.spaceId, spaceId));
  if (rows.length) await db.insert(availabilityRules).values(rows);
  await db.update(spaces).set({ availabilityMode: rows.length ? "rules" : "request", updatedAt: new Date() }).where(eq(spaces.id, spaceId));
  await recomputeCompleteness(spaceId);
  revalidatePath(`/admin/spaces/${spaceId}`);
}

export async function archiveSpace(formData: FormData) {
  await requireRole("ops");
  const id = fd.str(formData, "id")!;
  const restore = fd.bool(formData, "restore");
  await db.update(spaces).set({ status: restore ? "active" : "archived", updatedAt: new Date() }).where(eq(spaces.id, id));
  revalidatePath("/admin/spaces");
  revalidatePath(`/admin/spaces/${id}`);
}

/** Merge `sourceId` into `targetId`: move photos/docs/provenance/candidates, fill blank target fields, archive source. */
export async function mergeSpaces(formData: FormData) {
  const user = await requireRole("ops");
  const sourceId = fd.str(formData, "sourceId")!;
  const targetId = fd.str(formData, "targetId")!;
  if (sourceId === targetId) return;
  const [source, target] = await Promise.all([db.query.spaces.findFirst({ where: eq(spaces.id, sourceId) }), db.query.spaces.findFirst({ where: eq(spaces.id, targetId) })]);
  if (!source || !target) throw new Error("Space not found");
  const fill: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(source)) {
    if (["id", "slug", "locationId", "createdAt", "updatedAt", "status", "mergedIntoSpaceId", "completenessScore"].includes(k)) continue;
    const cur = (target as Record<string, unknown>)[k];
    if ((cur == null || (Array.isArray(cur) && cur.length === 0)) && v != null && !(Array.isArray(v) && v.length === 0)) fill[k] = v;
  }
  await db.transaction(async (tx) => {
    if (Object.keys(fill).length) await tx.update(spaces).set({ ...fill, updatedAt: new Date() }).where(eq(spaces.id, targetId));
    await tx.update(spacePhotos).set({ spaceId: targetId }).where(eq(spacePhotos.spaceId, sourceId));
    await tx.update(documents).set({ entityId: targetId }).where(and(eq(documents.entityType, "space"), eq(documents.entityId, sourceId)));
    await tx.update(factSources).set({ entityId: targetId }).where(and(eq(factSources.entityType, "space"), eq(factSources.entityId, sourceId)));
    await tx.update(schema.savedSpaces).set({ spaceId: targetId }).where(eq(schema.savedSpaces.spaceId, sourceId)).catch(() => {});
    await tx.update(schema.spaceViews).set({ spaceId: targetId }).where(eq(schema.spaceViews.spaceId, sourceId));
    await tx.update(spaces).set({ status: "archived", mergedIntoSpaceId: targetId, updatedAt: new Date() }).where(eq(spaces.id, sourceId));
  });
  await upsertProvenance("space", targetId, [{ sourceType: "manual_entry", confidence: "unknown", note: `Merged duplicate "${source.name}" (${source.slug}) by ${user.email}` }], user.id);
  await recomputeCompleteness(targetId);
  revalidatePath("/admin/duplicates");
  revalidatePath("/admin/spaces");
}

export async function mergeRestaurants(formData: FormData) {
  await requireRole("admin");
  const sourceId = fd.str(formData, "sourceId")!;
  const targetId = fd.str(formData, "targetId")!;
  if (sourceId === targetId) return;
  await db.transaction(async (tx) => {
    await tx.update(locations).set({ restaurantId: targetId }).where(eq(locations.restaurantId, sourceId));
    await tx.update(documents).set({ entityId: targetId }).where(and(eq(documents.entityType, "restaurant"), eq(documents.entityId, sourceId)));
    await tx.update(factSources).set({ entityId: targetId }).where(and(eq(factSources.entityType, "restaurant"), eq(factSources.entityId, sourceId)));
    await tx.update(restaurants).set({ status: "archived", updatedAt: new Date() }).where(eq(restaurants.id, sourceId));
  });
  revalidatePath("/admin/duplicates");
}

export { slugify };
