import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { listSpacesBySlugs } from "@/lib/data/spaces";
import { InquiryForm } from "./InquiryForm";

export const metadata: Metadata = { title: "Help me book this", robots: { index: false } };

export default async function InquirePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const slugs = (sp.spaces ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6);
  const spaces = await listSpacesBySlugs(slugs);
  const user = await getCurrentUser();
  if (!spaces.length) {
    return (
      <div className="container-page py-16">
        <EmptyState title="Pick a space first" body="Choose one or more spaces you'd like Red Rope to pursue, then come back here." action={<Link href="/search" className="btn-primary">Browse spaces</Link>} />
      </div>
    );
  }
  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-rope-700">Booking request</p>
        <h1 className="font-display mt-1 text-[36px] leading-tight text-ink-900">Tell us about your event</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-600">We'll contact the restaurant{spaces.length > 1 ? "s" : ""} on your behalf, confirm availability and pricing, and come back with options. This is free for you.</p>
        <InquiryForm
          spaces={spaces.map((s) => ({ id: s.id, slug: s.slug, name: s.name, restaurantName: s.restaurantName, neighborhoodName: s.neighborhoodName, photoUrl: s.photoUrl, spaceType: s.spaceType, maxSeated: s.maxSeated, maxStanding: s.maxStanding }))}
          defaults={{ guests: sp.guests, date: sp.date, time: sp.time, event: sp.event, budget: sp.budget, name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "" }}
          snapshot={JSON.stringify(sp)}
        />
      </div>
    </div>
  );
}
