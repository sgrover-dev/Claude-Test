import Link from "next/link";
import { notFound } from "next/navigation";
import { addCandidate, applySummary, assignInquiry, generateCustomerUpdate, generateOutreachDraft, getQuoteComparison, logEvent, recordQuote, requestDeposit, reviewDraft, saveInternalNotes, summarizeReply, updateCandidate, updateInquiryStatus } from "@/app/admin/actions/ops";
import { Input, Notice, PageHeader, Panel, Select, StatusPill, SubmitButton, TextArea } from "@/components/admin/ui";
import { isAiEnabled } from "@/lib/ai/client";
import { listOpsUsers, searchSpacesByName } from "@/lib/data/admin";
import { getInquiryForOps } from "@/lib/data/inquiries";
import { formatCents, formatDate, formatDateTime, formatTime, relativeTime } from "@/lib/format";
import { CANDIDATE_STATUS_LABELS, CANDIDATE_STATUS_ORDER, INQUIRY_STATUS_LABELS, candidateNeedsFollowUp, nextStatuses } from "@/lib/inquiries/state";
import { isStripeEnabled } from "@/lib/payments/stripe";
import type { NormalizedQuote } from "@/lib/quotes/normalize";
import { EVENT_TYPES, labelFor } from "@/lib/taxonomy";

const KIND_ICON: Record<string, string> = { email_out: "→", email_in: "←", phone_call: "☎", note: "✎", quote: "$", contract: "§", menu: "🍽", deposit_request: "💳", customer_message: "💬", customer_update: "📣", status_change: "•", ai_summary: "✦", system: "⚙" };

export default async function OpsInquiryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ addq?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const i = await getInquiryForOps(id);
  if (!i) notFound();
  const [users, comparison, addMatches] = await Promise.all([listOpsUsers(), getQuoteComparison(id), sp.addq ? searchSpacesByName(sp.addq) : Promise.resolve([])]);
  const budgetTotal = i.budgetCents ? (i.budgetIsPerPerson ? i.budgetCents * i.guestCount : i.budgetCents) : null;
  const pendingDrafts = i.aiDrafts.filter((d) => d.status === "draft");
  const summaries = i.aiDrafts.filter((d) => d.kind === "response_summary" && d.status === "approved");

  return (
    <>
      <PageHeader
        title={<>Inquiry #{i.number} <span className="ml-2 align-middle"><StatusPill value={i.status} /></span></>}
        eyebrow={<>{i.contactName} · <a href={`mailto:${i.contactEmail}`} className="hover:text-rope-700">{i.contactEmail}</a>{i.contactPhone ? ` · ${i.contactPhone}` : ""}{i.company ? ` · ${i.company}` : ""} · submitted {relativeTime(i.createdAt)}</>}
        back={{ href: "/admin/inquiries", label: "Inquiries" }}
        actions={
          <>
            <form action={assignInquiry} className="flex items-center gap-1">
              <input type="hidden" name="inquiryId" value={i.id} />
              <select name="userId" defaultValue={i.assignedToUserId ?? ""} className="input !w-auto !py-1.5 !text-[12.5px]"><option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}</select>
              <SubmitButton variant="secondary">Assign</SubmitButton>
            </form>
            <form action={updateInquiryStatus} className="flex items-center gap-1">
              <input type="hidden" name="inquiryId" value={i.id} />
              <select name="status" className="input !w-auto !py-1.5 !text-[12.5px]">{nextStatuses(i.status).map((s) => <option key={s} value={s}>{INQUIRY_STATUS_LABELS[s]}</option>)}</select>
              <SubmitButton>Move</SubmitButton>
            </form>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Panel title="Request">
            <div className="grid gap-x-6 gap-y-2 text-[13.5px] sm:grid-cols-3">
              <Row k="Event" v={labelFor(EVENT_TYPES, i.eventType) || "—"} />
              <Row k="Date" v={i.eventDate ? formatDate(i.eventDate, { weekday: "long" }) : "Flexible"} />
              <Row k="Time" v={`${i.startTime ? formatTime(i.startTime) : "—"}${i.timeFlexibility ? ` (${i.timeFlexibility})` : ""}`} />
              <Row k="Guests" v={String(i.guestCount)} />
              <Row k="Duration" v={i.durationMinutes ? `${i.durationMinutes / 60}h` : "—"} />
              <Row k="Budget" v={i.budgetCents ? `${formatCents(i.budgetCents)}${i.budgetIsPerPerson ? `/pp (≈ ${formatCents(budgetTotal)})` : ""}` : "—"} />
              <Row k="Privacy" v={i.privacyRequirement?.replace(/_/g, " ") ?? "—"} />
              <Row k="AV" v={i.avRequirements ?? "—"} />
              <Row k="Food" v={i.foodPreferences ?? "—"} />
              <Row k="Dietary" v={i.dietaryNeeds ?? "—"} />
              <Row k="Special requests" v={i.specialRequests ?? "—"} className="sm:col-span-2" />
            </div>
            <form action={saveInternalNotes} className="mt-3 flex items-end gap-2">
              <input type="hidden" name="inquiryId" value={i.id} />
              <TextArea label="Internal notes" name="internalNotes" defaultValue={i.internalNotes} rows={2} className="flex-1" />
              <SubmitButton variant="secondary">Save</SubmitButton>
            </form>
          </Panel>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-600">Candidate venues ({i.candidates.length})</h2>
              <form className="flex gap-1">
                <input name="addq" defaultValue={sp.addq ?? ""} placeholder="Add a space…" className="input !w-48 !py-1 !text-[12.5px]" />
                <SubmitButton variant="secondary">Search</SubmitButton>
              </form>
            </div>
            {addMatches.length ? (
              <div className="mb-3 rounded-lg border border-ink-200 bg-white p-2 text-[13px]">
                {addMatches.map((m) => (
                  <form key={m.id} action={addCandidate} className="flex items-center justify-between py-1">
                    <input type="hidden" name="inquiryId" value={i.id} />
                    <input type="hidden" name="spaceId" value={m.id} />
                    <span>{m.restaurantName} — {m.name}{m.maxSeated ? ` (${m.maxSeated} seated)` : ""}</span>
                    <SubmitButton variant="secondary">Add</SubmitButton>
                  </form>
                ))}
              </div>
            ) : null}
            <div className="space-y-4">
              {i.candidates.map((c) => {
                const r = c.space.location.restaurant;
                const q = c.quotes.find((x) => x.isCurrent);
                const n = q?.normalized as NormalizedQuote | undefined;
                const due = candidateNeedsFollowUp(c.status, c.lastContactAt);
                return (
                  <div key={c.id} className={`rounded-xl border bg-white ${due ? "border-gold-300" : "border-ink-200"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-ink-100 px-4 py-3">
                      <div>
                        <p className="text-[15px] font-semibold text-ink-900">{r.name} <span className="font-normal text-ink-600">— {c.space.name}</span>{c.isPreferred ? <span className="ml-2 rounded bg-rope-100 px-1.5 text-[11px] text-rope-800">customer favorite</span> : null}</p>
                        <p className="text-[12.5px] text-ink-600">
                          {c.space.location.neighborhood?.name ?? ""} · seats {c.space.maxSeated ?? "?"} · {c.space.privacy?.replace(/_/g, " ") ?? "privacy unknown"} · {c.space.fbMinimumCents ? `min ${formatCents(c.space.fbMinimumCents)}` : c.space.estPerPersonLowCents ? `${formatCents(c.space.estPerPersonLowCents)}/pp` : "pricing unknown"}
                          {" · "}<Link href={`/admin/spaces/${c.space.id}`} className="text-rope-700 hover:underline">space</Link>
                        </p>
                        <p className="text-[12.5px] text-ink-600">
                          Contact: {r.eventsContactName ?? "—"} {r.eventsContactEmail ? <a href={`mailto:${r.eventsContactEmail}`} className="text-rope-700 hover:underline">{r.eventsContactEmail}</a> : <span className="text-gold-700">no email</span>} {r.eventsContactPhone ?? r.phone ?? ""}
                        </p>
                      </div>
                      <div className="text-right text-[12px] text-ink-500">
                        <StatusPill value={c.status} />
                        <p className="mt-1">Last contact: {c.lastContactAt ? relativeTime(c.lastContactAt) : "never"}</p>
                        {c.nextFollowUpAt ? <p>Follow up {formatDate(c.nextFollowUpAt)}</p> : null}
                        {due ? <p className="font-medium text-gold-700">Follow-up due</p> : null}
                      </div>
                    </div>
                    {n ? (
                      <div className="border-b border-ink-100 bg-ink-50 px-4 py-2 text-[12.5px] text-ink-700">
                        <span className="font-medium text-ink-900">Quote:</span> est. all-in {formatCents(n.allInCents)} (≈ {formatCents(n.perPersonCents)}/pp) · F&B {formatCents(n.foodBeverageCents)}{n.roomFeeCents ? ` · room ${formatCents(n.roomFeeCents)}` : ""}{n.serviceChargePct != null ? ` · ${n.serviceChargePct}% svc` : ""}{n.taxPct != null ? ` · ${n.taxPct}% tax` : ""}{n.depositCents != null ? ` · deposit ${formatCents(n.depositCents)}` : ""} · <span className={n.confidence === "high" ? "text-sage-700" : "text-gold-700"}>{n.confidence} confidence</span>
                        {n.assumptions.length ? <span className="block text-[11.5px] text-ink-500">{n.assumptions.join(" ")}</span> : null}
                      </div>
                    ) : null}
                    {c.declineReason ? <p className="border-b border-ink-100 px-4 py-2 text-[12.5px] text-ink-600">Declined: {c.declineReason}</p> : null}
                    <div className="grid gap-3 px-4 py-3 lg:grid-cols-3">
                      <form action={updateCandidate} className="space-y-2 rounded-lg border border-ink-100 p-2">
                        <input type="hidden" name="inquiryId" value={i.id} />
                        <input type="hidden" name="candidateId" value={c.id} />
                        <Select label="Venue status" name="status" defaultValue={c.status} options={CANDIDATE_STATUS_ORDER.map((s) => ({ key: s, label: CANDIDATE_STATUS_LABELS[s] }))} blank={null} />
                        <Input label="Next follow-up" name="nextFollowUpAt" type="date" defaultValue={c.nextFollowUpAt ? c.nextFollowUpAt.toISOString().slice(0, 10) : ""} />
                        <Input label="Decline reason" name="declineReason" defaultValue={c.declineReason} />
                        <TextArea label="Notes" name="notes" defaultValue={c.notes} rows={2} />
                        <SubmitButton variant="secondary">Update</SubmitButton>
                      </form>
                      <div className="space-y-2 rounded-lg border border-ink-100 p-2">
                        <form action={generateOutreachDraft}>
                          <input type="hidden" name="inquiryId" value={i.id} />
                          <input type="hidden" name="candidateId" value={c.id} />
                          <SubmitButton className="w-full">✦ Draft outreach email</SubmitButton>
                        </form>
                        <form action={summarizeReply} className="space-y-1">
                          <input type="hidden" name="inquiryId" value={i.id} />
                          <input type="hidden" name="candidateId" value={c.id} />
                          <TextArea label="Paste venue reply" name="text" rows={4} placeholder="Paste the email or call notes. Red Rope logs it, extracts availability + pricing, and lists unanswered questions." />
                          <SubmitButton variant="secondary" className="w-full">✦ Log & summarize reply</SubmitButton>
                        </form>
                        <form action={logEvent} className="space-y-1">
                          <input type="hidden" name="inquiryId" value={i.id} />
                          <input type="hidden" name="candidateId" value={c.id} />
                          <div className="grid grid-cols-2 gap-1">
                            <Select label="Log" name="kind" options={[{ key: "email_out", label: "Email sent" }, { key: "email_in", label: "Email received" }, { key: "phone_call", label: "Phone call" }, { key: "note", label: "Note" }, { key: "menu", label: "Menu received" }, { key: "contract", label: "Contract received" }]} blank={null} />
                            <Input label="When" name="occurredAt" type="datetime-local" />
                          </div>
                          <Input label="Subject / summary" name="subject" />
                          <TextArea label="Details" name="body" rows={2} />
                          <SubmitButton variant="secondary" className="w-full">Log</SubmitButton>
                        </form>
                      </div>
                      <details className="rounded-lg border border-ink-100 p-2">
                        <summary className="cursor-pointer text-[12.5px] font-semibold text-ink-700">Record a quote manually</summary>
                        <form action={recordQuote} className="mt-2 space-y-2">
                          <input type="hidden" name="inquiryId" value={i.id} />
                          <input type="hidden" name="candidateId" value={c.id} />
                          <div className="grid grid-cols-2 gap-1">
                            <Input label="Guests" name="guestCount" type="number" defaultValue={i.guestCount} />
                            <Input label="F&B minimum $" name="fbMinimum" defaultValue={q?.fbMinimumCents != null ? q.fbMinimumCents / 100 : ""} />
                            <Input label="Per person $" name="perPerson" defaultValue={q?.perPersonCents != null ? q.perPersonCents / 100 : ""} />
                            <Input label="Room fee $" name="roomFee" defaultValue={q?.roomFeeCents != null ? q.roomFeeCents / 100 : ""} />
                            <Input label="Service %" name="serviceChargePct" defaultValue={q?.serviceChargePct} />
                            <Input label="Admin fee %" name="adminFeePct" defaultValue={q?.adminFeePct} />
                            <Input label="Tax %" name="taxPct" defaultValue={q?.taxPct} />
                            <Input label="Deposit $" name="deposit" defaultValue={q?.depositCents != null ? q.depositCents / 100 : ""} />
                          </div>
                          <label className="flex items-center gap-1.5 text-[12.5px]"><input type="checkbox" name="minimumIncludesRoomFee" defaultChecked={q?.minimumIncludesRoomFee ?? false} className="accent-rope-600" /> Minimum includes room fee</label>
                          <label className="flex items-center gap-1.5 text-[12.5px]"><input type="checkbox" name="minimumIncludesServiceAndTax" defaultChecked={q?.minimumIncludesServiceAndTax ?? false} className="accent-rope-600" /> Minimum inclusive of service & tax</label>
                          <Input label="Inclusions" name="inclusions" defaultValue={q?.inclusions} />
                          <Input label="Cancellation terms" name="cancellationTerms" defaultValue={q?.cancellationTerms} />
                          <TextArea label="Raw quote text" name="rawText" rows={2} defaultValue={q?.rawText} />
                          <SubmitButton className="w-full">Save & normalize</SubmitButton>
                        </form>
                      </details>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <Panel title="Quote comparison">
            {comparison.rows.length ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead className="text-left text-[11px] uppercase tracking-wider text-ink-500"><tr><th className="py-1 pr-3">Venue</th><th className="py-1 pr-3">F&B</th><th className="py-1 pr-3">Room</th><th className="py-1 pr-3">Service</th><th className="py-1 pr-3">Tax</th><th className="py-1 pr-3">Deposit</th><th className="py-1 pr-3">All-in</th><th className="py-1 pr-3">Per person</th><th className="py-1">Confidence</th></tr></thead>
                    <tbody className="divide-y divide-ink-100">
                      {comparison.rows.map((r) => (
                        <tr key={r.candidateId} className={budgetTotal && r.normalized.allInCents != null && r.normalized.allInCents > budgetTotal ? "text-gold-700" : ""}>
                          <td className="py-1.5 pr-3 font-medium text-ink-900">{r.restaurantName} — {r.spaceName}</td>
                          <td className="py-1.5 pr-3">{formatCents(r.normalized.foodBeverageCents)}</td>
                          <td className="py-1.5 pr-3">{formatCents(r.normalized.roomFeeCents)}</td>
                          <td className="py-1.5 pr-3">{formatCents(r.normalized.serviceChargeCents)}</td>
                          <td className="py-1.5 pr-3">{formatCents(r.normalized.taxCents)}</td>
                          <td className="py-1.5 pr-3">{formatCents(r.normalized.depositCents)}</td>
                          <td className="py-1.5 pr-3 font-semibold">{formatCents(r.normalized.allInCents)}</td>
                          <td className="py-1.5 pr-3">{formatCents(r.normalized.perPersonCents)}</td>
                          <td className="py-1.5">{r.normalized.confidence}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[12.5px] text-ink-600">{comparison.narrative}</p>
              </>
            ) : <p className="text-[13px] text-ink-500">No quotes recorded yet.</p>}
          </Panel>

          <Panel title="Timeline">
            <ol className="space-y-2">
              {i.events.map((e) => {
                const cand = e.candidateId ? i.candidates.find((c) => c.id === e.candidateId) : null;
                return (
                  <li key={e.id} className="flex gap-3 text-[13px]">
                    <span className="w-6 shrink-0 text-center text-ink-400">{KIND_ICON[e.kind] ?? "•"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 text-[12px] text-ink-500">
                        <span className="font-medium text-ink-700">{e.kind.replace(/_/g, " ")}</span>
                        <span>{e.actorType}</span>
                        {cand ? <span>· {cand.space.location.restaurant.name}</span> : null}
                        <span>· {formatDateTime(e.occurredAt)}</span>
                      </div>
                      {e.subject ? <p className="font-medium text-ink-900">{e.subject}</p> : null}
                      {e.body ? <p className="whitespace-pre-line text-ink-700">{e.body.length > 600 ? `${e.body.slice(0, 600)}…` : e.body}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title={<>AI assistant {isAiEnabled() ? "" : <span className="ml-1 normal-case text-gold-700">(template mode)</span>}</>} actions={<form action={generateCustomerUpdate}><input type="hidden" name="inquiryId" value={i.id} /><SubmitButton variant="secondary">✦ Draft customer update</SubmitButton></form>}>
            <p className="mb-3 text-[12px] text-ink-500">Nothing is sent without your approval. Approve & send emails the venue contact or customer through the configured provider and logs it; approve only marks it ready for you to send manually.</p>
            {pendingDrafts.length ? (
              <div className="space-y-3">
                {pendingDrafts.map((d) => {
                  const cand = d.candidateId ? i.candidates.find((c) => c.id === d.candidateId) : null;
                  const to = d.kind === "customer_update" ? i.contactEmail : cand?.space.location.restaurant.eventsContactEmail ?? null;
                  return (
                    <form key={d.id} action={reviewDraft} className="rounded-lg border border-gold-300 bg-gold-100/40 p-3">
                      <input type="hidden" name="inquiryId" value={i.id} />
                      <input type="hidden" name="draftId" value={d.id} />
                      <p className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-gold-700">{d.kind.replace(/_/g, " ")}{cand ? ` → ${cand.space.location.restaurant.name}` : d.kind === "customer_update" ? ` → ${i.contactName}` : ""} · {d.model}</p>
                      {d.structured && (d.structured as { error?: string }).error ? <p className="mb-1 text-[11.5px] text-rope-700">{(d.structured as { error?: string }).error}</p> : null}
                      <Input label="Subject" name="subject" defaultValue={d.subject} />
                      <TextArea label="Body" name="content" defaultValue={d.content} rows={10} className="mt-1" />
                      <p className="mt-1 text-[11.5px] text-ink-500">To: {to ?? <span className="text-gold-700">no email on file — approve, then send manually and log it</span>}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <SubmitButton name="decision" value="approve_send">{to ? "Approve & send" : "Approve & mark sent"}</SubmitButton>
                        <SubmitButton name="decision" value="approve" variant="secondary">Approve only</SubmitButton>
                        <SubmitButton name="decision" value="reject" variant="danger">Discard</SubmitButton>
                      </div>
                    </form>
                  );
                })}
              </div>
            ) : <p className="text-[13px] text-ink-500">No drafts awaiting review. Use “Draft outreach” on a venue or “Draft customer update”.</p>}

            {summaries.length ? (
              <div className="mt-4 space-y-2">
                <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-600">Venue reply summaries</h3>
                {summaries.slice(0, 5).map((d) => {
                  const s = d.structured as unknown as { availability: string; suggestedCandidateStatus: string; unansweredQuestions: string[]; suggestedFollowUps: string[]; quote: Record<string, unknown> } | null;
                  return (
                    <div key={d.id} className="rounded-lg border border-ink-200 p-3 text-[12.5px]">
                      <p className="font-medium text-ink-900">{d.subject}</p>
                      <p className="mt-1 whitespace-pre-line text-ink-700">{d.content}</p>
                      {s ? (
                        <form action={applySummary} className="mt-2 flex items-center gap-2">
                          <input type="hidden" name="inquiryId" value={i.id} />
                          <input type="hidden" name="draftId" value={d.id} />
                          <SubmitButton variant="secondary">Apply: set venue to “{s.suggestedCandidateStatus.replace(/_/g, " ")}”{Object.values(s.quote ?? {}).some((v) => v != null) ? " + record quote" : ""}</SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {i.aiDrafts.filter((d) => d.status === "sent" || d.status === "approved" || d.status === "rejected").filter((d) => d.kind !== "response_summary").length ? (
              <details className="mt-3 text-[12.5px] text-ink-600"><summary className="cursor-pointer">Draft history</summary>
                <ul className="mt-1 space-y-1">{i.aiDrafts.filter((d) => d.kind !== "response_summary" && d.status !== "draft").map((d) => <li key={d.id}><StatusPill value={d.status} /> {d.kind.replace(/_/g, " ")} — {d.subject} <span className="text-ink-400">{formatDateTime(d.createdAt)}</span></li>)}</ul>
              </details>
            ) : null}
          </Panel>

          <Panel title="Deposit & payments">
            {i.payments.length ? (
              <ul className="mb-3 space-y-1 text-[13px]">{i.payments.map((p) => <li key={p.id} className="flex justify-between"><span>{p.description ?? p.kind} · {formatCents(p.amountCents)}</span><StatusPill value={p.status} /></li>)}</ul>
            ) : null}
            <form action={requestDeposit} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <input type="hidden" name="inquiryId" value={i.id} />
              <Input label="Amount $" name="amount" placeholder="500" />
              <Input label="Description" name="description" defaultValue="Red Rope booking deposit" />
              <div className="flex items-end"><SubmitButton>Request</SubmitButton></div>
            </form>
            <p className="mt-2 text-[11.5px] text-ink-500">{isStripeEnabled() ? "Customer gets a Stripe Checkout link on their tracking page." : "Stripe is not configured; the customer sees the request and you collect payment manually."} Restaurant settlement is out of scope for V1.</p>
          </Panel>

          {i.user ? <Notice tone="info">Customer has an account ({i.user.email}) and can see options, choose one, and message you from their tracking page.</Notice> : <Notice tone="warn">Customer hasn't signed in yet; they received a magic link. Customer updates you send here go by email.</Notice>}
        </div>
      </div>
    </>
  );
}

function Row({ k, v, className = "" }: { k: string; v: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[11.5px] font-medium uppercase tracking-wider text-ink-500">{k}</dt>
      <dd className="text-ink-900">{v}</dd>
    </div>
  );
}
