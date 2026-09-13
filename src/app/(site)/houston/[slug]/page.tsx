import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SearchBar } from "@/components/search/SearchBar";
import { SpaceCard } from "@/components/search/SpaceCard";
import { EmptyState } from "@/components/ui";
import { listNeighborhoods } from "@/lib/data/cities";
import { savedSpaceIdsForCurrentUser } from "@/lib/data/saved";
import { listSpacesForLanding } from "@/lib/data/spaces";
import { searchHref } from "@/lib/search/params";
import { OCCASION_PAGES } from "@/lib/taxonomy";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const isOccasion = OCCASION_PAGES.some((o) => o.slug === slug);
  return listSpacesForLanding("houston", isOccasion ? { occasionSlug: slug } : { neighborhoodSlug: slug });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  if (data.occasion) {
    return {
      title: `${data.occasion.title} in Houston restaurants — ${data.spaces.length} spaces`,
      description: `${data.occasion.intro} Compare capacity, privacy and pricing for ${data.spaces.length} restaurant spaces in Houston.`,
      alternates: { canonical: `/houston/${slug}` },
    };
  }
  return {
    title: `Private dining & group spaces in ${data.neighborhood!.name}, Houston`,
    description: `${data.spaces.length} reservable restaurant spaces in ${data.neighborhood!.name}: private dining rooms, patios and buyouts with capacity and pricing.`,
    alternates: { canonical: `/houston/${slug}` },
  };
}

export default async function LandingPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const [saved, hoods] = await Promise.all([savedSpaceIdsForCurrentUser(), listNeighborhoods(data.city.id)]);
  const title = data.occasion ? `${data.occasion.title} in Houston` : `Group spaces in ${data.neighborhood!.name}`;
  const intro = data.occasion ? data.occasion.intro : data.neighborhood!.description ?? `Reservable rooms, patios and buyouts inside ${data.neighborhood!.name} restaurants.`;
  const searchLink = data.occasion
    ? searchHref({ eventType: data.occasion.eventTypes[0], privacy: data.occasion.privacy, spaceTypes: data.occasion.spaceTypes })
    : searchHref({ neighborhood: data.neighborhood!.slug });

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    itemListElement: data.spaces.slice(0, 50).map((s, i) => ({ "@type": "ListItem", position: i + 1, name: `${s.name} at ${s.restaurantName}`, url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/spaces/${s.slug}` })),
  };

  return (
    <div className="container-page py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      <nav className="text-[13px] text-ink-500">
        <Link href="/houston" className="hover:text-rope-700">Houston</Link> <span className="mx-1">/</span> {title}
      </nav>
      <h1 className="font-display mt-2 text-[38px] leading-tight text-ink-900">{title}</h1>
      <p className="mt-2 max-w-2xl text-[16px] text-ink-600">{intro}</p>
      <div className="mt-6 max-w-4xl">
        <SearchBar neighborhoods={hoods} initial={data.neighborhood ? { neighborhood: data.neighborhood.slug } : {}} compact />
      </div>
      <div className="mt-8 flex items-center justify-between">
        <p className="text-[14px] text-ink-600">{data.spaces.length} spaces</p>
        <Link href={searchLink} className="text-[14px] text-rope-700 hover:underline">Refine with filters →</Link>
      </div>
      {data.spaces.length ? (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.spaces.map((s) => (
            <SpaceCard key={s.id} item={{ space: s }} saved={saved.has(s.id)} />
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState title="Nothing listed here yet" body="Tell Red Rope what you need and our team will research options directly." action={<Link href="/search" className="btn-primary">Tell Red Rope</Link>} />
        </div>
      )}
      <section className="mt-14 grid gap-3 sm:grid-cols-3">
        {OCCASION_PAGES.filter((o) => o.slug !== slug).slice(0, 6).map((o) => (
          <Link key={o.slug} href={`/houston/${o.slug}`} className="card px-4 py-3 text-[14px] font-medium text-ink-900 hover:border-ink-400">
            {o.title} in Houston →
          </Link>
        ))}
      </section>
    </div>
  );
}
