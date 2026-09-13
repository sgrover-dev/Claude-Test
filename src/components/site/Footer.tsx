import Link from "next/link";
import { OCCASION_PAGES } from "@/lib/taxonomy";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-ink-200/70 bg-white">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-[14.5px] leading-relaxed text-ink-600">
            The reservation layer for restaurant event spaces. Search real rooms, patios and buyouts by capacity, privacy and price — then let Red Rope handle the restaurant.
          </p>
          <p className="mt-4 text-[12.5px] text-ink-500">Launching in Houston, TX.</p>
        </div>
        <div>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-500">Houston</p>
          <ul className="space-y-2 text-[14px] text-ink-700">
            {OCCASION_PAGES.slice(0, 6).map((o) => (
              <li key={o.slug}>
                <Link href={`/houston/${o.slug}`} className="hover:text-rope-700">
                  {o.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-500">Company</p>
          <ul className="space-y-2 text-[14px] text-ink-700">
            <li><Link href="/how-it-works" className="hover:text-rope-700">How it works</Link></li>
            <li><Link href="/restaurants" className="hover:text-rope-700">For restaurants</Link></li>
            <li><Link href="/login" className="hover:text-rope-700">Sign in</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-100">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-5 text-[12.5px] text-ink-500">
          <span>© {new Date().getFullYear()} Red Rope</span>
          <span>Pricing and capacity are verified where marked; estimates are labeled as such.</span>
        </div>
      </div>
    </footer>
  );
}
