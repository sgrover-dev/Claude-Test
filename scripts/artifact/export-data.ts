/* Exports the public inventory as JSON for the mobile prototype artifact. */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";

async function main() {
  const rows = await db.query.spaces.findMany({
    where: and(eq(schema.spaces.status, "active"), isNull(schema.spaces.mergedIntoSpaceId)),
    with: { photos: true, availabilityRules: true, location: { with: { restaurant: true, neighborhood: true } } },
  });
  const provenance = await db.query.factSources.findMany({ where: eq(schema.factSources.entityType, "space") });
  const docs = await db.query.documents.findMany({ where: eq(schema.documents.entityType, "restaurant") });
  const rank = { verified: 3, publicly_listed: 2, estimate: 1, unknown: 0 } as const;
  const out = rows
    .filter((s) => s.location.restaurant.status === "active")
    .map((s) => {
      const prov = provenance.filter((p) => p.entityId === s.id);
      const conf: Record<string, string> = {};
      for (const p of prov) {
        const key = p.field ?? "*";
        if (!conf[key] || rank[p.confidence] > rank[conf[key] as keyof typeof rank]) conf[key] = p.confidence;
      }
      const sources = Array.from(new Set(prov.map((p) => p.sourceType)));
      const r = s.location.restaurant;
      return {
        id: s.id, slug: s.slug, name: s.name, description: s.description, spaceType: s.spaceType, privacy: s.privacy, indoorOutdoor: s.indoorOutdoor,
        minGuests: s.minGuests, maxSeated: s.maxSeated, maxStanding: s.maxStanding, configurations: s.configurations,
        fbMinimumCents: s.fbMinimumCents, roomFeeCents: s.roomFeeCents, estPerPersonLowCents: s.estPerPersonLowCents, estPerPersonHighCents: s.estPerPersonHighCents,
        daypartMinimums: s.daypartMinimums, depositCents: s.depositCents, serviceChargePct: s.serviceChargePct ? Number(s.serviceChargePct) : null, taxPct: s.taxPct ? Number(s.taxPct) : null,
        cancellationPolicy: s.cancellationPolicy, pricingNotes: s.pricingNotes, amenities: s.amenities, foodStyles: s.foodStyles, ambiance: s.ambiance, suitableFor: s.suitableFor,
        featureNotes: s.featureNotes, availabilityMode: s.availabilityMode, availabilityNotes: s.availabilityNotes, maxDurationMinutes: s.maxDurationMinutes,
        outsideCakePolicy: s.outsideCakePolicy, decorPolicy: s.decorPolicy, verificationStatus: s.verificationStatus, lastVerifiedAt: s.lastVerifiedAt, completenessScore: s.completenessScore,
        photoCount: s.photos.length, photoUrl: s.photos[0]?.url ?? null,
        latLng: s.location.lat && s.location.lng ? { lat: Number(s.location.lat), lng: Number(s.location.lng) } : null,
        neighborhoodSlug: s.location.neighborhood?.slug ?? null, neighborhoodName: s.location.neighborhood?.name ?? null,
        address: [s.location.addressLine1, s.location.cityName, s.location.state, s.location.postalCode].filter(Boolean).join(", "),
        hasValet: s.location.hasValet, hasParkingLot: s.location.hasParkingLot, isWheelchairAccessible: s.location.isWheelchairAccessible,
        restaurantId: r.id, restaurantName: r.name, restaurantSlug: r.slug, cuisines: r.cuisines, priceTier: r.priceTier, websiteUrl: r.websiteUrl, eventsPageUrl: r.eventsPageUrl,
        menus: docs.filter((d) => d.entityId === r.id).map((d) => ({ title: d.title, url: d.url })),
        confidence: conf, sources,
      };
    });
  const hoods = await db.query.neighborhoods.findMany({ orderBy: (n, { asc }) => asc(n.name) });
  const data = { generatedAt: new Date().toISOString(), city: "Houston", neighborhoods: hoods.map((n) => ({ slug: n.slug, name: n.name, aliases: n.aliases, lat: Number(n.lat), lng: Number(n.lng) })), spaces: out };
  const file = process.argv[2] ?? "scripts/artifact/spaces.json";
  writeFileSync(file, JSON.stringify(data));
  console.log(`wrote ${out.length} spaces to ${file}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
