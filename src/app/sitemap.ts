import type { MetadataRoute } from "next";
import { getCityBySlug, listNeighborhoods } from "@/lib/data/cities";
import { listAllActiveRestaurantSlugs, listAllActiveSpaceSlugs } from "@/lib/data/spaces";
import { OCCASION_PAGES } from "@/lib/taxonomy";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const [spaces, restaurants, city] = await Promise.all([listAllActiveSpaceSlugs(), listAllActiveRestaurantSlugs(), getCityBySlug("houston")]);
  const hoods = city ? await listNeighborhoods(city.id) : [];
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/houston`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/search`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/how-it-works`, changeFrequency: "monthly", priority: 0.5 },
    ...OCCASION_PAGES.map((o) => ({ url: `${base}/houston/${o.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...hoods.map((h) => ({ url: `${base}/houston/${h.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...restaurants.map((r) => ({ url: `${base}/restaurants/${r.slug}`, lastModified: r.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...spaces.map((s) => ({ url: `${base}/spaces/${s.slug}`, lastModified: s.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
