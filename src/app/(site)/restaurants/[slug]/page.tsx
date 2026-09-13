import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SpaceCard } from "@/components/search/SpaceCard";
import { Badge } from "@/components/ui";
import { savedSpaceIdsForCurrentUser } from "@/lib/data/saved";
import { getRestaurantBySlug } from "@/lib/data/spaces";
import { CUISINES, labelFor } from "@/lib/taxonomy";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = await getRestaurantBySlug(slug);
  if (!r) return { title: "Restaurant not found" };
  return {
    title: `${r.name} private dining & event spaces`,
    description: `${r.spaces.length} reservable group spaces at ${r.name}${r.locations[0]?.neighborhood ? ` in ${r.locations[0].neighborhood.name}` : ""}: capacity, privacy and pricing on Red Rope.`,
    alternates: { canonical: `/restaurants/${r.slug}` },
  };
}

export default async function RestaurantPage({ params }: Props) {
  const { slug } = await params;
  const r = await getRestaurantBySlug(slug);
  if (!r || r.status === "archived") notFound();
  const saved = await savedSpaceIdsForCurrentUser();
  return (
    <div className="container-page py-8">
      <nav className="mb-4 text-[13px] text-ink-500">
        <Link href="/houston" className="hover:text-rope-700">Houston</Link>
        <span className="mx-1.5">/</span>
        <span>Restaurants</span>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-display text-[38px] leading-tight text-ink-900">{r.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {r.cuisines.map((c) => (
              <Badge key={c} tone="neutral">{labelFor(CUISINES, c)}</Badge>
            ))}
            {r.priceTier ? <Badge tone="outline">{"$".repeat(r.priceTier)}</Badge> : null}
            {r.claimedAt ? <Badge tone="sage">Claimed by restaurant</Badge> : null}
          </div>
          {r.description ? <p className="mt-4 text-[15.5px] leading-relaxed text-ink-700">{r.description}</p> : null}
        </div>
        <div className="card min-w-[260px] p-4 text-[14px] text-ink-700">
          {r.locations.map((l) => (
            <div key={l.id} className="mb-3 last:mb-0">
              {l.name ? <p className="font-medium text-ink-900">{l.name}</p> : null}
              <p>{[l.addressLine1, l.cityName, l.state, l.postalCode].filter(Boolean).join(", ")}</p>
              {l.neighborhood ? <Link href={`/houston/${l.neighborhood.slug}`} className="text-rope-700 hover:underline">{l.neighborhood.name}</Link> : null}
            </div>
          ))}
          {r.websiteUrl ? (
            <a href={r.websiteUrl} target="_blank" rel="noreferrer nofollow" className="mt-2 inline-block text-rope-700 hover:underline">
              Restaurant website ↗
            </a>
          ) : null}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-[26px] text-ink-900">Spaces at {r.name}</h2>
        <p className="mt-1 text-[14.5px] text-ink-600">Each space is searchable on its own — pick the one that fits your group.</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {r.spaces.map((s) => (
            <SpaceCard key={s.id} item={{ space: s }} saved={saved.has(s.id)} />
          ))}
        </div>
      </section>

      <section className="mt-14 rounded-2xl border border-dashed border-ink-300 bg-white p-6 text-[14.5px] text-ink-600">
        <p className="font-medium text-ink-900">Are you {r.name}?</p>
        <p className="mt-1">Red Rope lists your spaces from public information and confirms details with your team when a customer inquires. Claiming your listing is coming soon — it will let you control your information and respond faster.</p>
        <Link href="/restaurants" className="mt-3 inline-block text-rope-700 hover:underline">Learn more about Red Rope for restaurants →</Link>
      </section>
    </div>
  );
}
