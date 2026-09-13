import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SpaceImage } from "@/components/space/SpaceImage";
import { Badge, ConfidenceBadge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { getInquiryForCustomer } from "@/lib/data/inquiries";
import { formatCents, formatDate, formatDateTime, formatTime } from "@/lib/format";
import { INQUIRY_STATUS_CUSTOMER, INQUIRY_STATUS_ORDER } from "@/lib/inquiries/state";
import { isStripeEnabled } from "@/lib/payments/stripe";
import type { NormalizedQuote } from "@/lib/quotes/normalize";
import { EVENT_TYPES, labelFor } from "@/lib/taxonomy";
import { CustomerActions } from "./CustomerActions";

export const metadata: Metadata = { title: "Your request", robots: { index: false } };

const CUSTOMER_STEPS = ["submitted", "contacting_venues", "options_available", "customer_selected", "booked"] as const;

export default async function CustomerInquiryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/account/inquiries/${id}`);
  const inquiry = await getInquiryForCustomer(id, { userId: user.id, email: user.email });
  if (!inquiry) notFound();

  const statusIdx = INQUIRY_STATUS_ORDER.indexOf(inquiry.status);
  const stepIdx = (s: string) => INQUIRY_STATUS_ORDER.indexOf(s as never);
  const visibleCandidates = inquiry.candidates.filter((c) => c.status !== "customer_rejected");
  const options = visibleCandidates.filter((c) => ["available", "quote_received", "customer_selected"].includes(c.status));
  const pendingPayment = inquiry.payments.find((p) => p.status === "pending");
  const paidPayment = inquiry.payments.find((p) => p.status === "succeeded");

  return (
    <div className="container-page py-8">
      <Link href="/account" className="text-[13px] text-ink-500 hover:text-rope-700">← All requests</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] text-ink-900">
            {labelFor(EVENT_TYPES, inquiry.eventType) || "Group event"} for {inquiry.guestCount}
          </h1>
          <p className="text-[14.5px] text-ink-600">
            Request #{inquiry.number} · {inquiry.eventDate ? formatDate(inquiry.eventDate, { weekday: "long" }) : "Date flexible"}{inquiry.startTime ? ` at ${formatTime(inquiry.startTime)}` : ""}
          </p>
        </div>
        <Badge tone={inquiry.status === "booked" ? "sage" : "gold"} className="!text-[13px] !px-3 !py-1">{INQUIRY_STATUS_CUSTOMER[inquiry.status]}</Badge>
      </div>

      {sp.paid ? <p className="mt-4 rounded-xl bg-sage-100 px-4 py-3 text-[14px] text-sage-700">Thanks — your deposit is in. We're finalizing the booking.</p> : null}

      <ol className="mt-6 grid grid-cols-5 gap-1 text-center text-[12px]">
        {CUSTOMER_STEPS.map((s, i) => {
          const done = statusIdx >= stepIdx(s) && !["cancelled", "closed"].includes(inquiry.status);
          return (
            <li key={s} className="flex flex-col items-center gap-1.5">
              <span className={`h-1.5 w-full rounded-full ${done ? "bg-rope-600" : "bg-ink-200"}`} />
              <span className={done ? "font-medium text-ink-900" : "text-ink-400"}>{["Received", "Contacting venues", "Options ready", "You chose", "Booked"][i]}</span>
            </li>
          );
        })}
      </ol>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          {pendingPayment && inquiry.status === "deposit_required" ? (
            <section className="rounded-2xl border border-gold-300 bg-gold-100/60 p-5">
              <h2 className="text-[17px] font-semibold text-ink-900">Deposit needed to hold your date</h2>
              <p className="mt-1 text-[14.5px] text-ink-700">{pendingPayment.description} — {formatCents(pendingPayment.amountCents)}</p>
              {isStripeEnabled() ? (
                <a href={`/api/payments/checkout?payment=${pendingPayment.id}`} className="btn-primary mt-3">Pay {formatCents(pendingPayment.amountCents)} securely</a>
              ) : (
                <p className="mt-2 text-[13.5px] text-ink-600">Your concierge will send a secure payment link shortly.</p>
              )}
            </section>
          ) : null}
          {paidPayment ? <p className="text-[13.5px] text-sage-700">Deposit of {formatCents(paidPayment.amountCents)} received {formatDate(paidPayment.updatedAt)}.</p> : null}

          <section>
            <h2 className="font-display text-[24px] text-ink-900">{options.length ? "Your options" : "Venues we're pursuing"}</h2>
            <div className="mt-4 space-y-4">
              {(options.length ? options : visibleCandidates).map((c) => {
                const quote = c.quotes.find((q) => q.isCurrent);
                const n = quote?.normalized as NormalizedQuote | null | undefined;
                const s = c.space;
                return (
                  <article key={c.id} className={`card overflow-hidden ${c.status === "customer_selected" ? "ring-2 ring-rope-500" : ""}`}>
                    <div className="flex flex-col sm:flex-row">
                      <SpaceImage src={s.photos[0]?.url ?? null} alt={s.name} spaceType={s.spaceType} className="h-40 w-full sm:h-auto sm:w-56" />
                      <div className="flex-1 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h3 className="font-display text-[20px] text-ink-900">
                              <Link href={`/spaces/${s.slug}`} className="hover:text-rope-700">{s.name}</Link>
                            </h3>
                            <p className="text-[14px] text-ink-600">{s.location.restaurant.name}{s.location.neighborhood ? ` · ${s.location.neighborhood.name}` : ""}</p>
                          </div>
                          <CandidateStatusBadge status={c.status} />
                        </div>
                        {n?.allInCents != null ? (
                          <div className="mt-3 rounded-xl bg-ink-50 p-3 text-[14px]">
                            <div className="flex items-baseline justify-between">
                              <span className="text-ink-600">Estimated all-in for {n.guestCount}</span>
                              <span className="font-display text-[20px] text-ink-900">{formatCents(n.allInCents)}{n.allInHighCents && n.allInHighCents !== n.allInCents ? `–${formatCents(n.allInHighCents)}` : ""}</span>
                            </div>
                            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[13px] text-ink-600 sm:grid-cols-3">
                              {n.foodBeverageCents != null ? <span>F&B {formatCents(n.foodBeverageCents)}</span> : null}
                              {n.roomFeeCents ? <span>Room {formatCents(n.roomFeeCents)}</span> : null}
                              {n.serviceChargeCents ? <span>Service {formatCents(n.serviceChargeCents)}</span> : null}
                              {n.taxCents ? <span>Tax {formatCents(n.taxCents)}</span> : null}
                              {n.depositCents != null ? <span>Deposit {formatCents(n.depositCents)}</span> : null}
                              <span>≈ {formatCents(n.perPersonCents)}/person</span>
                            </div>
                            {quote?.inclusions ? <p className="mt-1 text-[13px] text-ink-600">Includes: {quote.inclusions}</p> : null}
                            {quote?.cancellationTerms ? <p className="text-[13px] text-ink-600">Cancellation: {quote.cancellationTerms}</p> : null}
                            {n.assumptions.length ? (
                              <details className="mt-1 text-[12.5px] text-ink-500">
                                <summary className="cursor-pointer">Assumptions <ConfidenceBadge confidence={n.confidence === "high" ? "verified" : "estimate"} compact /></summary>
                                <ul className="mt-1 list-disc pl-4">{n.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
                              </details>
                            ) : null}
                          </div>
                        ) : c.status === "available" ? (
                          <p className="mt-3 text-[14px] text-sage-700">Available on your date — pricing details coming.</p>
                        ) : c.status === "unavailable" ? (
                          <p className="mt-3 text-[14px] text-ink-500">Not available{c.declineReason ? `: ${c.declineReason}` : "."}</p>
                        ) : (
                          <p className="mt-3 text-[14px] text-ink-500">Waiting to hear back from the restaurant.</p>
                        )}
                        {["available", "quote_received"].includes(c.status) ? <CustomerActions inquiryId={inquiry.id} candidateId={c.id} mode="select" /> : null}
                        {c.status === "customer_selected" ? <p className="mt-3 text-[13.5px] font-medium text-rope-700">You chose this option. We're confirming with the restaurant.</p> : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="font-display text-[24px] text-ink-900">Messages</h2>
            <CustomerActions inquiryId={inquiry.id} mode="message" />
            <ul className="mt-4 space-y-3">
              {inquiry.events.map((e) => (
                <li key={e.id} className={`rounded-xl px-4 py-3 text-[14px] ${e.kind === "customer_message" ? "ml-8 bg-rope-50" : "bg-white border border-ink-200"}`}>
                  <div className="flex items-center justify-between gap-2 text-[12px] text-ink-500">
                    <span>{e.kind === "customer_message" ? "You" : e.kind === "status_change" ? "Status update" : "Red Rope"}</span>
                    <span>{formatDateTime(e.occurredAt)}</span>
                  </div>
                  {e.subject ? <p className="mt-0.5 font-medium text-ink-900">{e.subject}</p> : null}
                  {e.body ? <p className="mt-0.5 whitespace-pre-line text-ink-700">{e.body}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="card h-fit p-5 text-[14px] text-ink-700 lg:sticky lg:top-24">
          <h3 className="text-[15px] font-semibold text-ink-900">Your request</h3>
          <dl className="mt-2 space-y-1.5">
            <Row k="Guests" v={String(inquiry.guestCount)} />
            <Row k="Date" v={inquiry.eventDate ? formatDate(inquiry.eventDate, { weekday: "short" }) : "Flexible"} />
            <Row k="Time" v={inquiry.startTime ? formatTime(inquiry.startTime) : inquiry.timeFlexibility ?? "Flexible"} />
            <Row k="Budget" v={inquiry.budgetCents ? `${formatCents(inquiry.budgetCents)}${inquiry.budgetIsPerPerson ? "/person" : ""}` : "Not set"} />
            {inquiry.privacyRequirement ? <Row k="Privacy" v={inquiry.privacyRequirement.replace(/_/g, " ")} /> : null}
            {inquiry.avRequirements ? <Row k="AV" v={inquiry.avRequirements} /> : null}
            {inquiry.dietaryNeeds ? <Row k="Dietary" v={inquiry.dietaryNeeds} /> : null}
            {inquiry.specialRequests ? <Row k="Notes" v={inquiry.specialRequests} /> : null}
          </dl>
          <p className="mt-4 text-[12.5px] text-ink-500">Need to change something? Send us a message and we'll update the venues.</p>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-500">{k}</dt>
      <dd className="text-right text-ink-900">{v}</dd>
    </div>
  );
}

function CandidateStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, "sage" | "gold" | "neutral" | "rope" | "outline"]> = {
    not_contacted: ["Queued", "outline"],
    contacted: ["Awaiting reply", "gold"],
    follow_up_due: ["Following up", "gold"],
    needs_clarification: ["Clarifying", "gold"],
    available: ["Available", "sage"],
    quote_received: ["Quote in", "sage"],
    unavailable: ["Unavailable", "neutral"],
    customer_selected: ["Your pick", "rope"],
    customer_rejected: ["Passed", "neutral"],
  };
  const [label, tone] = map[status] ?? [status, "neutral"];
  return <Badge tone={tone}>{label}</Badge>;
}
