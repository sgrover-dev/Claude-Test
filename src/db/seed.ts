import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { db, schema } from "./index";
import { houston } from "./seed-data/houston";
import type { SeedCity } from "./seed-data/types";
import { parseVenueCsv } from "@/lib/ingestion/csv";
import { applyInventoryPayload } from "@/lib/ingestion/apply";

const { cities, neighborhoods, users } = schema;

async function seedCity(city: SeedCity) {
  const [cityRow] = await db
    .insert(cities)
    .values({ slug: city.slug, name: city.name, state: city.state, timezone: city.timezone, lat: String(city.lat), lng: String(city.lng) })
    .onConflictDoUpdate({ target: cities.slug, set: { name: city.name } })
    .returning();
  for (const n of city.neighborhoods) {
    await db
      .insert(neighborhoods)
      .values({ cityId: cityRow.id, slug: n.slug, name: n.name, aliases: n.aliases ?? [], lat: String(n.lat), lng: String(n.lng), description: n.description })
      .onConflictDoUpdate({ target: [neighborhoods.cityId, neighborhoods.slug], set: { name: n.name, aliases: n.aliases ?? [], lat: String(n.lat), lng: String(n.lng) } });
  }
  return cityRow;
}

async function importCsv(cityId: string, file: string) {
  const text = readFileSync(file, "utf8");
  const hoods = await db.query.neighborhoods.findMany({ where: (n, { eq }) => eq(n.cityId, cityId) });
  const parsed = parseVenueCsv(text, hoods.map((n) => ({ slug: n.slug, name: n.name, aliases: n.aliases })), { defaultCity: "Houston", defaultState: "TX" });
  console.log(`csv: ${parsed.rowCount} rows → ${parsed.payloads.length} restaurants`);
  if (parsed.skipped.length) console.log(`skipped: ${parsed.skipped.join("; ")}`);
  if (parsed.unmappedNeighborhoods.length) console.log(`unmapped neighborhoods: ${parsed.unmappedNeighborhoods.join(", ")}`);
  let restaurants = 0;
  let spacesCreated = 0;
  let spacesUpdated = 0;
  for (const payload of parsed.payloads) {
    const res = await applyInventoryPayload(payload, {
      cityId,
      preserveExisting: true,
      defaultProvenance: { sourceType: "csv_import", confidence: "publicly_listed", note: `Imported from ${path.basename(file)}` },
    });
    restaurants += res.created.restaurant ? 1 : 0;
    spacesCreated += res.created.spaces;
    spacesUpdated += res.updated.spaces;
    console.log(`${res.created.restaurant ? "created" : "updated"}: ${payload.restaurant.name} (${res.created.spaces} new spaces, ${res.updated.spaces} updated)`);
  }
  console.log(`done: ${restaurants} new restaurants, ${spacesCreated} new spaces, ${spacesUpdated} updated spaces`);
}

async function seedAdmin() {
  const emails = (process.env.ADMIN_EMAILS ?? "admin@redrope.local").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  for (const email of emails) {
    await db.insert(users).values({ email, name: "Red Rope Ops", role: "admin" }).onConflictDoUpdate({ target: users.email, set: { role: "admin" } });
  }
  console.log(`admin users: ${emails.join(", ")}`);
}

async function main() {
  const city = await seedCity(houston);
  const file = process.argv[2] ?? path.join(process.cwd(), "data/imports/houston-venues.csv");
  await importCsv(city.id, file);
  await seedAdmin();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
