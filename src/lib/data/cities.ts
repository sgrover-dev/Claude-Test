import "server-only";
import { asc, eq } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/db";
import type { NeighborhoodHint } from "@/lib/ai/fallback";

export const getCityBySlug = cache(async (slug: string) => {
  return db.query.cities.findFirst({ where: eq(schema.cities.slug, slug) });
});

export const listActiveCities = cache(async () => {
  return db.query.cities.findMany({ where: eq(schema.cities.isActive, true), orderBy: asc(schema.cities.name) });
});

export const listNeighborhoods = cache(async (cityId: string) => {
  return db.query.neighborhoods.findMany({ where: eq(schema.neighborhoods.cityId, cityId), orderBy: asc(schema.neighborhoods.name) });
});

export async function neighborhoodHints(cityId: string): Promise<NeighborhoodHint[]> {
  const rows = await listNeighborhoods(cityId);
  return rows.map((n) => ({ slug: n.slug, name: n.name, aliases: n.aliases }));
}

/** Default sales tax by city; stored in code for now, per-city column later. */
export function cityDefaultTaxPct(citySlug: string): number {
  return { houston: 8.25 }[citySlug] ?? 8.25;
}
