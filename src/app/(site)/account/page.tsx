import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { deleteSavedSearch } from "@/app/actions/saved";
import { SpaceCard } from "@/components/search/SpaceCard";
import { Badge, EmptyState } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { listInquiriesForUser } from "@/lib/data/inquiries";
import { savedSearchesForUser, savedSpacesForUser } from "@/lib/data/saved";
import { formatDate } from "@/lib/format";
import { INQUIRY_STATUS_CUSTOMER, isTerminal } from "@/lib/inquiries/state";
import { searchHref } from "@/lib/search/params";
import type { SearchFilters } from "@/lib/search/types";
import { EVENT_TYPES, labelFor } from "@/lib/taxonomy";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const [inquiries, saved, searches] = await Promise.all([listInquiriesForUser(user.id), savedSpacesForUser(user.id), savedSearchesForUser(user.id)]);
  const active = inquiries.filter((i) => !isTerminal(i.status));
  const past = inquiries.filter((i) => isTerminal(i.status));

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] text-ink-900">{user.name ? `Hi, ${user.name.split(" ")[0]}` : "Your account"}</h1>
          <p className="text-[14px] text-ink-600">{user.email}</p>
        </div>
        <form action={logout}>
          <button className="btn-ghost btn-sm">Sign out</button>
        </form>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-[24px] text-ink-900">Your requests</h2>
        {active.length || past.length ? (
          <div className="mt-4 space-y-3">
            {[...active, ...past].map((i) => (
              <Link key={i.id} href={`/account/inquiries/${i.id}`} className="card flex flex-wrap items-center justify-between gap-3 p-4 hover:border-ink-400">
                <div>
                  <p className="text-[15px] font-semibold text-ink-900">
                    #{i.number} · {labelFor(EVENT_TYPES, i.eventType) || "Group event"} for {i.guestCount}
                  </p>
                  <p className="text-[13.5px] text-ink-600">
                    {i.eventDate ? formatDate(i.eventDate, { weekday: "short" }) : "Date flexible"} · {i.candidates.map((c) => c.space.location.restaurant.name).join(", ")}
                  </p>
                </div>
                <Badge tone={isTerminal(i.status) ? "neutral" : i.status === "options_available" || i.status === "customer_reviewing" ? "sage" : "gold"}>{INQUIRY_STATUS_CUSTOMER[i.status]}</Badge>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState title="No requests yet" body="Find a space and tell us when you'd like to host." action={<Link href="/search" className="btn-primary">Browse spaces</Link>} />
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-[24px] text-ink-900">Saved spaces</h2>
        {saved.length ? (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {saved.map((s) => (
              <SpaceCard key={s.id} item={{ space: s }} saved />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[14.5px] text-ink-500">Tap the heart on any space to save it here.</p>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-[24px] text-ink-900">Saved searches</h2>
        {searches.length ? (
          <ul className="mt-4 space-y-2">
            {searches.map((s) => (
              <li key={s.id} className="card flex items-center justify-between gap-3 px-4 py-3">
                <Link href={searchHref(s.query as Partial<SearchFilters>)} className="text-[15px] font-medium text-ink-900 hover:text-rope-700">
                  {s.name}
                </Link>
                <form action={deleteSavedSearch.bind(null, s.id)}>
                  <button className="text-[13px] text-ink-500 hover:text-rope-700">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[14.5px] text-ink-500">Save a search from the results page to re-run it later.</p>
        )}
      </section>
    </div>
  );
}
