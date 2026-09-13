import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Request received", robots: { index: false } };

export default async function ThanksPage({ searchParams }: { searchParams: Promise<{ n?: string; id?: string; dev?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  return (
    <div className="container-page flex justify-center py-16">
      <div className="card w-full max-w-lg p-8 text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sage-700">Request received</p>
        <h1 className="font-display mt-1 text-[32px] text-ink-900">We're on it{sp.n ? ` — #${sp.n}` : ""}.</h1>
        <p className="mt-3 text-[15px] text-ink-600">A Red Rope concierge will contact the restaurant{`(s)`} and update you with availability and pricing. Most restaurants reply within one business day.</p>
        {user ? (
          <Link href={sp.id ? `/account/inquiries/${sp.id}` : "/account"} className="btn-primary mt-6">Track this request</Link>
        ) : (
          <div className="mt-6 rounded-xl bg-ink-50 p-4 text-[14px] text-ink-700">
            <p>We emailed you a sign-in link so you can track progress and message us.</p>
            {sp.dev ? (
              <p className="mt-2 text-[13px]">
                <span className="font-medium">Development mode:</span>{" "}
                <Link href={sp.dev} className="text-rope-700 underline">open your tracking page</Link>
              </p>
            ) : null}
          </div>
        )}
        <Link href="/search" className="mt-4 block text-[14px] text-ink-500 hover:text-rope-700">Keep browsing</Link>
      </div>
    </div>
  );
}
