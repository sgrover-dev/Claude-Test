import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SearchBar } from "@/components/search/SearchBar";
import { SpaceCard } from "@/components/search/SpaceCard";
import { SectionTitle } from "@/components/ui";
import { getCityBySlug, listNeighborhoods } from "@/lib/data/cities";
import { featuredSpaces, neighborhoodsWithCounts } from "@/lib/data/spaces";
import { OCCASION_PAGES } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Private dining rooms & event spaces in Houston restaurants",
  description: "Browse private dining rooms, semi-private spaces, patios and full buyouts inside Houston restaurants by neighborhood, capacity and occasion. Verified capacities and pricing where available.",
  alternates: { canonical: "/houston" },
};

export default async function HoustonPage() {
  const city = await getCityBySlug("houston");
  if (!city) notFound();
  const [hoods, counts, featured] = await Promise.all([listNeighborhoods(city.id), neighborhoodsWithCounts(city.id), featuredSpaces("houston", 8)]);
  const total = counts.reduce((n, c) => n + c.count, 0);
  return (
    <div className="container-page py-10">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-rope-700">Houston, Texas</p>
      <h1 className="font-display mt-1 text-[40px] leading-tight text-ink-900 sm:text-[48px]">Restaurant spaces for groups in Houston</h1>
      <p className="mt-3 max-w-2xl text-[16px] text-ink-600">{total} reservable spaces inside Houston restaurants — private dining rooms, patios, wine rooms and buyouts — organized by capacity, privacy and neighborhood.</p>
      <div className="mt-6 max-w-4xl">
        <SearchBar neighborhoods={hoods} />
      </div>

      <section className="mt-14">
        <SectionTitle eyebrow="By neighborhood" title="Where do you want to host?" />
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {counts.filter((c) => c.count > 0).map((c) => (
            <Link key={c.id} href={`/houston/${c.slug}`} className="card flex items-center justify-between px-4 py-3.5 hover:border-ink-400">
              <span className="font-medium text-ink-900">{c.name}</span>
              <span className="text-[13px] text-ink-500">{c.count} spaces</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <SectionTitle eyebrow="By occasion" title="What are you hosting?" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OCCASION_PAGES.map((o) => (
            <Link key={o.slug} href={`/houston/${o.slug}`} className="card p-4 hover:border-ink-400">
              <p className="font-semibold text-ink-900">{o.title}</p>
              <p className="mt-0.5 text-[13.5px] text-ink-600">{o.intro}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <SectionTitle eyebrow="Featured" title="Well-documented spaces" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((s) => (
            <SpaceCard key={s.id} item={{ space: s }} />
          ))}
        </div>
      </section>
    </div>
  );
}
