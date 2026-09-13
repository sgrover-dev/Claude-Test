import Link from "next/link";
import { ConciergeBox } from "@/components/search/ConciergeBox";
import { SearchBar } from "@/components/search/SearchBar";
import { SpaceCard } from "@/components/search/SpaceCard";
import { SectionTitle } from "@/components/ui";
import { getCityBySlug, listNeighborhoods } from "@/lib/data/cities";
import { featuredSpaces, neighborhoodsWithCounts } from "@/lib/data/spaces";
import { DEFAULT_CITY } from "@/lib/search/types";
import { OCCASION_PAGES } from "@/lib/taxonomy";
import { HomeSearch } from "./HomeSearch";

export default async function HomePage() {
  const city = await getCityBySlug(DEFAULT_CITY);
  const [hoods, featured, hoodCounts] = city ? await Promise.all([listNeighborhoods(city.id), featuredSpaces(city.slug, 8), neighborhoodsWithCounts(city.id)]) : [[], [], []];

  return (
    <>
      <section className="relative overflow-hidden bg-ink-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(179,38,30,0.55),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(201,162,74,0.25),transparent_50%)]" />
        <div className="container-page relative py-20 sm:py-28">
          <p className="mb-4 text-[12.5px] font-semibold uppercase tracking-[0.18em] text-gold-300">Houston · Private dining, patios, wine rooms & buyouts</p>
          <h1 className="font-display max-w-3xl text-[44px] leading-[1.02] text-white sm:text-[64px]">Find a restaurant space for your group.</h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-white/75">
            Finding a table for four is easy. Finding the right room for 25 is not. Red Rope indexes the spaces inside restaurants — capacity, privacy, minimums — and handles the back-and-forth with the restaurant for you.
          </p>
          <div className="mt-10 max-w-4xl">
            <HomeSearch searchBar={<SearchBar neighborhoods={hoods} />} concierge={<ConciergeBox />} />
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-white/60">
            <span>Search by space, not restaurant</span>
            <span>Pricing labeled verified vs. estimate</span>
            <span>We contact the restaurant for you</span>
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <SectionTitle eyebrow="Featured" title="Spaces worth a look" body="A mix of verified rooms and well-documented listings across the city." action={<Link href="/search" className="btn-secondary">Browse all spaces</Link>} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((s) => (
            <SpaceCard key={s.id} item={{ space: s }} />
          ))}
        </div>
      </section>

      <section className="border-y border-ink-200/70 bg-white">
        <div className="container-page grid gap-10 py-16 md:grid-cols-3">
          {[
            { n: "1", t: "Search structured inventory", b: "Every space has capacity, privacy level, amenities and pricing — with a label telling you whether it's verified, listed by the restaurant, or our estimate." },
            { n: "2", t: "Tell us what you need", b: "Pick one space or a few. Give us the date, headcount and budget. You don't need an account to start." },
            { n: "3", t: "Red Rope books it", b: "We contact the restaurant, confirm availability, normalize the quotes into comparable all-in numbers, and get you to a booked room." },
          ].map((s) => (
            <div key={s.n}>
              <span className="font-display text-[40px] leading-none text-rope-600">{s.n}</span>
              <h3 className="mt-3 text-[18px] font-semibold text-ink-900">{s.t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{s.b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-16">
        <SectionTitle eyebrow="Neighborhoods" title="Where in Houston?" />
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {hoodCounts.filter((h) => h.count > 0).map((h) => (
            <Link key={h.id} href={`/houston/${h.slug}`} className="card group flex items-center justify-between px-4 py-3.5 hover:border-ink-400">
              <span className="font-medium text-ink-900 group-hover:text-rope-700">{h.name}</span>
              <span className="text-[13px] text-ink-500">{h.count} {h.count === 1 ? "space" : "spaces"}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-page pb-16">
        <SectionTitle eyebrow="Occasions" title="Built for whatever you're hosting" />
        <div className="flex flex-wrap gap-2">
          {OCCASION_PAGES.map((o) => (
            <Link key={o.slug} href={`/houston/${o.slug}`} className="chip !px-4 !py-2 !text-[14px]">
              {o.title}
            </Link>
          ))}
        </div>
      </section>

      <section className="container-page pb-20">
        <div className="card flex flex-col items-start gap-4 bg-gradient-to-br from-white to-ink-100 p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-rope-700">For restaurants</p>
            <h3 className="font-display mt-1 text-[26px] text-ink-900">We're already sending you groups.</h3>
            <p className="mt-1 max-w-xl text-[15px] text-ink-600">Restaurants don't need an account to be on Red Rope. When you're ready, claim your listing to control your information and respond faster.</p>
          </div>
          <Link href="/restaurants" className="btn-dark shrink-0">
            Learn more
          </Link>
        </div>
      </section>
    </>
  );
}
