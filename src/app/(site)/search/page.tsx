import type { Metadata } from "next";
import Link from "next/link";
import { ConciergeBox } from "@/components/search/ConciergeBox";
import { ConciergeSummary } from "@/components/search/ConciergeSummary";
import { FilterPanel } from "@/components/search/FilterPanel";
import { SearchBar } from "@/components/search/SearchBar";
import { SpaceCard } from "@/components/search/SpaceCard";
import { EmptyState } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { listNeighborhoods } from "@/lib/data/cities";
import { savedSpaceIdsForCurrentUser } from "@/lib/data/saved";
import { searchSpaces } from "@/lib/data/spaces";
import { parseSearchParams, searchHref, type RawSearchParams } from "@/lib/search/params";
import { EVENT_TYPES, labelFor } from "@/lib/taxonomy";

export const metadata: Metadata = { title: "Search restaurant spaces in Houston" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const raw = await searchParams;
  const filters = parseSearchParams(raw);
  const [result, user, saved] = await Promise.all([searchSpaces(filters), getCurrentUser(), savedSpaceIdsForCurrentUser()]);
  if (!result) {
    return (
      <div className="container-page py-16">
        <EmptyState title="We're not in that city yet" body="Red Rope is live in Houston. More cities are coming." action={<Link href="/search" className="btn-primary">Search Houston</Link>} />
      </div>
    );
  }
  const hoods = await listNeighborhoods(result.city.id);
  const title = [
    filters.guests ? `Spaces for ${filters.guests}` : "Restaurant spaces",
    filters.eventType ? `for a ${labelFor(EVENT_TYPES, filters.eventType).toLowerCase()}` : null,
    result.neighborhood ? `in ${result.neighborhood.name}` : `in ${result.city.name}`,
  ]
    .filter(Boolean)
    .join(" ");

  const pageHref = (page: number) => searchHref({ ...filters, page });

  return (
    <div className="container-page py-6">
      <div className="mb-6">
        <SearchBar neighborhoods={hoods} initial={filters} compact />
      </div>
      <div className="grid gap-8 lg:grid-cols-[270px_1fr]">
        <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-2 scrollbar-none">
          <FilterPanel filters={filters} isSignedIn={!!user} />
        </div>
        <div>
          {raw.concierge ? <ConciergeSummary /> : null}
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-[26px] leading-tight text-ink-900">{title}</h1>
              <p className="mt-1 text-[14px] text-ink-600">
                {result.total} {result.total === 1 ? "space" : "spaces"}
                {filters.date ? ` · availability confirmed on request` : ""}
              </p>
            </div>
            <form className="flex items-center gap-2 text-[14px]">
              <label className="text-ink-500">Sort</label>
              <SortSelect current={filters.sort ?? "relevance"} filters={filters} />
            </form>
          </div>

          {result.results.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {result.results.map((item) => (
                <SpaceCard key={item.space.id} item={item} saved={saved.has(item.space.id)} guests={filters.guests} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No spaces match every filter"
              body="Try loosening privacy or budget, or tell Red Rope what you need and we'll research options beyond what's listed."
              action={<Link href={searchHref({ city: filters.city, guests: filters.guests, neighborhood: filters.neighborhood })} className="btn-secondary">Reset filters</Link>}
            />
          )}

          {result.nearby.length ? (
            <section className="mt-12">
              <h2 className="font-display text-[22px] text-ink-900">Nearby {result.neighborhood?.name}</h2>
              <p className="mb-4 mt-1 text-[14px] text-ink-600">Good matches a short drive away.</p>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {result.nearby.map((item) => (
                  <SpaceCard key={item.space.id} item={item} saved={saved.has(item.space.id)} guests={filters.guests} />
                ))}
              </div>
            </section>
          ) : null}

          {result.pageCount > 1 ? (
            <nav className="mt-8 flex items-center justify-center gap-2 text-[14px]">
              {result.page > 1 ? <Link href={pageHref(result.page - 1)} className="btn-secondary btn-sm">Previous</Link> : null}
              <span className="text-ink-600">
                Page {result.page} of {result.pageCount}
              </span>
              {result.page < result.pageCount ? <Link href={pageHref(result.page + 1)} className="btn-secondary btn-sm">Next</Link> : null}
            </nav>
          ) : null}

          <div className="mt-12 rounded-2xl border border-ink-200 bg-white p-5">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-rope-700">Not seeing it?</p>
            <h2 className="font-display mt-1 text-[22px] text-ink-900">Tell Red Rope what you're looking for</h2>
            <p className="mb-3 mt-1 text-[14px] text-ink-600">Describe the event in your own words. We'll translate it into filters, and if nothing listed fits, our team researches options directly with restaurants.</p>
            <ConciergeBox compact />
          </div>
        </div>
      </div>
    </div>
  );
}

function SortSelect({ current, filters }: { current: string; filters: ReturnType<typeof parseSearchParams> }) {
  const options = [
    ["relevance", "Best match"],
    ["price_asc", "Price: low to high"],
    ["price_desc", "Price: high to low"],
    ["capacity", "Capacity"],
  ] as const;
  return (
    <div className="flex gap-1">
      {options.map(([k, label]) => (
        <Link key={k} href={searchHref({ ...filters, sort: k, page: 1 })} className={`chip ${current === k ? "chip-active" : ""}`} scroll={false}>
          {label}
        </Link>
      ))}
    </div>
  );
}
