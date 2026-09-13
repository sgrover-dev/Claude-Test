import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "How it works", description: "How Red Rope finds and books restaurant spaces for groups." };

export default function HowItWorksPage() {
  return (
    <div className="container-page max-w-3xl py-14">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-rope-700">How it works</p>
      <h1 className="font-display mt-1 text-[40px] leading-tight text-ink-900">Search spaces. We handle the restaurant.</h1>
      <div className="prose-rr mt-6 space-y-8 text-[16px] leading-relaxed text-ink-700">
        <Step n="1" title="Search actual spaces, not restaurants">
          Red Rope indexes the reservable rooms inside restaurants — private dining rooms, semi-private sections, patios, wine rooms, chef's tables and full buyouts. Each one has its own capacity, privacy level, amenities and pricing, so you search for the room that fits your group instead of guessing from a restaurant's homepage.
        </Step>
        <Step n="2" title="Know what's verified and what isn't">
          Restaurant event information is scattered and often stale. We label every fact: <strong>verified</strong> (we confirmed it with the restaurant), <strong>publicly listed</strong> (from their own materials), or a <strong>Red Rope estimate</strong>. We never present a guess as fact, and we tell you when something is unknown.
        </Step>
        <Step n="3" title="Tell us what you need">
          Pick a space, or a few acceptable ones, and send us the date, headcount, budget and any requirements — AV, privacy, dietary needs. You don't need an account to start; we'll email you a link to follow progress.
        </Step>
        <Step n="4" title="We contact the restaurant for you">
          Red Rope reaches out to the events team, confirms availability and capacity, and collects the details that matter: minimums, room fees, deposits, service charges, cancellation terms, menus, AV. We pursue several options in parallel if you want.
        </Step>
        <Step n="5" title="Compare normalized quotes">
          One restaurant quotes a minimum plus gratuity. Another quotes per person plus a room fee. We normalize every quote into an estimated all-in and per-person number with the assumptions spelled out, so you can actually compare.
        </Step>
        <Step n="6" title="Book with confidence">
          Once you choose, we coordinate the deposit and contract with the restaurant and stay on the thread until the event is booked.
        </Step>
      </div>
      <div className="mt-10 flex gap-3">
        <Link href="/search" className="btn-primary">Start searching</Link>
        <Link href="/restaurants" className="btn-secondary">For restaurants</Link>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="flex gap-5">
      <span className="font-display shrink-0 text-[34px] leading-none text-rope-600">{n}</span>
      <div>
        <h2 className="text-[20px] font-semibold text-ink-900">{title}</h2>
        <p className="mt-1.5">{children}</p>
      </div>
    </section>
  );
}
