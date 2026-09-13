import Link from "next/link";
import type { ReactNode } from "react";
import { CONFIDENCE_LEVELS, PRIVACY_LEVELS, labelFor } from "@/lib/taxonomy";

export function Badge({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: "neutral" | "rope" | "sage" | "gold" | "ink" | "outline"; className?: string }) {
  const tones: Record<string, string> = {
    neutral: "bg-ink-100 text-ink-700",
    rope: "bg-rope-100 text-rope-800",
    sage: "bg-sage-100 text-sage-700",
    gold: "bg-gold-100 text-gold-700",
    ink: "bg-ink-900 text-white",
    outline: "border border-ink-200 bg-white text-ink-700",
  };
  return <span className={`badge ${tones[tone]} ${className}`}>{children}</span>;
}

export function PrivacyBadge({ privacy }: { privacy: string | null | undefined }) {
  if (!privacy) return <Badge tone="outline">Privacy unknown</Badge>;
  const tone = privacy === "fully_private" || privacy === "buyout" ? "sage" : privacy === "semi_private" ? "gold" : "neutral";
  return <Badge tone={tone}>{labelFor(PRIVACY_LEVELS, privacy)}</Badge>;
}

export function ConfidenceBadge({ confidence, compact = false }: { confidence: string | null | undefined; compact?: boolean }) {
  const c = confidence ?? "unknown";
  const tone = c === "verified" ? "sage" : c === "publicly_listed" ? "neutral" : c === "estimate" ? "gold" : "outline";
  const label = compact ? { verified: "Verified", publicly_listed: "Listed", estimate: "Estimate", unknown: "Unknown" }[c] : labelFor(CONFIDENCE_LEVELS, c);
  return (
    <Badge tone={tone} className="uppercase tracking-wide text-[10.5px]">
      {c === "verified" ? <CheckIcon /> : null}
      {label}
    </Badge>
  );
}

export function VerificationBadge({ status }: { status: string }) {
  if (status === "verified") return <Badge tone="sage"><CheckIcon /> Verified by Red Rope</Badge>;
  if (status === "publicly_listed") return <Badge tone="neutral">From restaurant listing</Badge>;
  return <Badge tone="outline">Unverified</Badge>;
}

export function CheckIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
    </svg>
  );
}

export function Field({ label, children, hint, htmlFor }: { label: string; children: ReactNode; hint?: string; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[12.5px] text-ink-500">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <h3 className="font-display text-xl text-ink-900">{title}</h3>
      {body ? <p className="mt-2 max-w-md text-[15px] text-ink-600">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ChipLink({ href, active, children }: { href: string; active?: boolean; children: ReactNode }) {
  return (
    <Link href={href} className={`chip ${active ? "chip-active" : ""}`} scroll={false}>
      {children}
    </Link>
  );
}

export function SectionTitle({ eyebrow, title, body, action }: { eyebrow?: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-rope-700">{eyebrow}</p> : null}
        <h2 className="font-display text-[28px] leading-tight text-ink-900 sm:text-[32px]">{title}</h2>
        {body ? <p className="mt-1.5 max-w-2xl text-[15px] text-ink-600">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint, tone = "neutral" }: { label: string; value: ReactNode; hint?: string; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const tones = { neutral: "text-ink-900", good: "text-sage-700", warn: "text-gold-700", bad: "text-rope-700" };
  return (
    <div className="card px-5 py-4">
      <p className="text-[12.5px] font-medium text-ink-500">{label}</p>
      <p className={`mt-1 font-display text-[28px] leading-none ${tones[tone]}`}>{value}</p>
      {hint ? <p className="mt-1.5 text-[12px] text-ink-500">{hint}</p> : null}
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  );
}
