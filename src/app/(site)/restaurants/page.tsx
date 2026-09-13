import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Red Rope for restaurants", description: "Red Rope brings group bookings to Houston restaurants. No account needed to be listed." };

export default function ForRestaurantsPage() {
  return (
    <div className="container-page max-w-3xl py-14">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-rope-700">For restaurants</p>
      <h1 className="font-display mt-1 text-[40px] leading-tight text-ink-900">We bring you the 25-top you'd never have found.</h1>
      <div className="mt-6 space-y-5 text-[16px] leading-relaxed text-ink-700">
        <p>Red Rope is where Houston groups go to find a room for 10 to 100 people. We list your private dining rooms, patios and buyouts from public information, and when a customer wants to book, our concierge team reaches out to your events contact with a complete, qualified request: date, headcount, budget, requirements.</p>
        <p>There's nothing to set up. You don't need an account, a login or a calendar integration. You'll simply start hearing from us with well-organized inquiries.</p>
        <h2 className="font-display pt-4 text-[26px] text-ink-900">Claim your listing (coming soon)</h2>
        <p>Restaurants that claim their listing will be able to correct capacity and pricing, upload menus and photos, respond to inquiries directly, share availability, and eventually accept instant bookings. We'll also share demand data — how many people viewed your spaces and what they were looking for.</p>
        <p className="text-[14.5px] text-ink-500">Want to update something now? Email <a href="mailto:restaurants@redrope.co" className="text-rope-700 underline">restaurants@redrope.co</a>.</p>
      </div>
      <Link href="/search" className="btn-secondary mt-8">See how you appear to customers</Link>
    </div>
  );
}
