import Link from "next/link";
import { PageHeader, Panel, StatusPill } from "@/components/admin/ui";
import { Stat } from "@/components/ui";
import { inventoryStats, recentJobs } from "@/lib/data/admin";
import { listInquiriesForOps } from "@/lib/data/inquiries";
import { formatDate, relativeTime } from "@/lib/format";
import { isAiEnabled } from "@/lib/ai/client";
import { isStripeEnabled } from "@/lib/payments/stripe";
import { getEmailProvider } from "@/lib/email";

export default async function AdminDashboard() {
  const [s, inquiries, jobs] = await Promise.all([inventoryStats(), listInquiriesForOps({ status: "active" }), recentJobs(6)]);
  const pct = (n: number) => (s.totalSpaces ? `${Math.round((n / s.totalSpaces) * 100)}%` : "—");
  return (
    <>
      <PageHeader title="Dashboard" eyebrow="Red Rope operations" actions={<><Link href="/admin/ingestion" className="btn-secondary btn-sm">Import inventory</Link><Link href="/admin/restaurants/new" className="btn-dark btn-sm">New restaurant</Link></>} />

      <div className="mb-6 flex flex-wrap gap-2 text-[12px]">
        <span className={`rounded-md px-2 py-1 ${isAiEnabled() ? "bg-sage-100 text-sage-700" : "bg-gold-100 text-gold-700"}`}>AI: {isAiEnabled() ? "Anthropic connected" : "fallback mode (no ANTHROPIC_API_KEY)"}</span>
        <span className={`rounded-md px-2 py-1 ${isStripeEnabled() ? "bg-sage-100 text-sage-700" : "bg-ink-100 text-ink-600"}`}>Payments: {isStripeEnabled() ? "Stripe connected" : "not configured"}</span>
        <span className="rounded-md bg-ink-100 px-2 py-1 text-ink-600">Email: {getEmailProvider().name}</span>
      </div>

      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-ink-500">Operations</h2>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Active inquiries" value={s.active} hint={`${s.new7} new this week`} />
        <Stat label="Awaiting venues" value={s.awaitingVenue} tone={s.awaitingVenue ? "warn" : "neutral"} />
        <Stat label="Follow-ups due" value={s.followUps} tone={s.followUps ? "bad" : "good"} hint="No venue reply in 48h" />
        <Stat label="Waiting on customer" value={s.needsCustomer} />
        <Stat label="Booked (30d)" value={s.booked30} tone="good" />
      </div>

      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-ink-500">Inventory quality</h2>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Stat label="Restaurants" value={s.totalRestaurants} hint={`${s.claimed} claimed`} />
        <Stat label="Locations" value={s.totalLocations} hint={`${s.geocoded} with coordinates`} />
        <Stat label="Spaces" value={s.totalSpaces} hint={`avg completeness ${s.avgCompleteness}%`} />
        <Stat label="With capacity" value={pct(s.withCapacity)} hint={`${s.withCapacity} spaces`} tone={s.withCapacity / Math.max(1, s.totalSpaces) > 0.8 ? "good" : "warn"} />
        <Stat label="With pricing" value={pct(s.withPricing)} hint={`${s.withPricing} spaces`} tone={s.withPricing / Math.max(1, s.totalSpaces) > 0.5 ? "good" : "warn"} />
        <Stat label="With photos" value={pct(s.withPhotos)} hint={`${s.withPhotos} spaces`} tone={s.withPhotos ? "neutral" : "bad"} />
        <Stat label="With privacy level" value={pct(s.withPrivacy)} />
        <Stat label="Verified contact" value={`${s.contactVerified}/${s.totalRestaurants}`} hint={`${s.withContact} have any contact`} />
        <Stat label="Reviewed in last 90d" value={s.verified90} hint={`${s.verified} confirmed by phone/email`} />
        <Stat label="Stale listings" value={s.stale} tone={s.stale ? "warn" : "good"} hint="Not verified in 90 days" />
        <Stat label="Incomplete (<60%)" value={s.incomplete} tone={s.incomplete ? "warn" : "good"} />
        <Stat label="Pending review" value={s.pendingReview} tone={s.pendingReview ? "warn" : "neutral"} hint="AI/CSV candidates" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Active inquiries" actions={<Link href="/admin/inquiries" className="text-[12.5px] text-rope-700 hover:underline">All inquiries</Link>}>
          {inquiries.length ? (
            <ul className="divide-y divide-ink-100">
              {inquiries.slice(0, 8).map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/admin/inquiries/${i.id}`} className="min-w-0">
                    <p className="truncate font-medium text-ink-900">#{i.number} {i.contactName} · {i.guestCount} guests{i.eventDate ? ` · ${formatDate(i.eventDate)}` : ""}</p>
                    <p className="truncate text-[12.5px] text-ink-500">{i.candidates.map((c) => c.space.location.restaurant.name).join(", ") || "No candidates yet"}</p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2 text-[12px] text-ink-500">
                    <StatusPill value={i.status} />
                    {relativeTime(i.updatedAt)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-500">No active inquiries.</p>
          )}
        </Panel>
        <div className="space-y-6">
          <Panel title="Quick filters">
            <div className="flex flex-wrap gap-1.5">
              {[
                ["Missing capacity", "/admin/spaces?missing=capacity"],
                ["Missing pricing", "/admin/spaces?missing=pricing"],
                ["Missing photos", "/admin/spaces?missing=photos"],
                ["Missing privacy", "/admin/spaces?missing=privacy"],
                ["No events contact", "/admin/spaces?missing=contact"],
                ["Stale", "/admin/spaces?stale=1"],
                ["Unverified", "/admin/spaces?verification=unverified"],
              ].map(([l, h]) => (
                <Link key={h} href={h} className="chip !py-0.5 text-[12px]">{l}</Link>
              ))}
            </div>
          </Panel>
          <Panel title="Recent ingestion" actions={<Link href="/admin/ingestion" className="text-[12.5px] text-rope-700 hover:underline">Queue</Link>}>
            {jobs.length ? (
              <ul className="divide-y divide-ink-100">
                {jobs.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/admin/ingestion/${j.id}`} className="min-w-0 truncate">
                      <span className="font-medium">{j.source.toUpperCase()}</span> <span className="text-ink-600">{j.inputLabel ?? j.inputUrl ?? j.id.slice(0, 8)}</span>
                    </Link>
                    <StatusPill value={j.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-500">No ingestion jobs yet.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
