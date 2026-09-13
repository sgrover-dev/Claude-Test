"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import type { CandidateStatus, InquiryStatus, TimelineKind } from "@/db/schema";
import { compareQuotes, draftCustomerUpdate, draftVenueOutreach, summarizeVenueResponse, type CandidateBrief, type InquiryBrief, type VenueBrief } from "@/lib/ai/logistics";
import { requireRole } from "@/lib/auth/session";
import { cityDefaultTaxPct } from "@/lib/data/cities";
import { addCandidateSpaces, addInquiryEvent, getInquiryForOps, setCandidateStatus, setInquiryStatus, type OpsInquiry } from "@/lib/data/inquiries";
import { sendEmail } from "@/lib/email";
import { fd } from "@/lib/forms";
import { createDepositRequest } from "@/lib/payments/stripe";
import { normalizeQuote, type NormalizedQuote } from "@/lib/quotes/normalize";

const { quotes, aiDrafts, inquiries, inquiryCandidates } = schema;

function brief(i: OpsInquiry): InquiryBrief {
  return {
    number: i.number,
    contactName: i.contactName,
    eventType: i.eventType,
    eventDate: i.eventDate,
    startTime: i.startTime,
    timeFlexibility: i.timeFlexibility,
    durationMinutes: i.durationMinutes,
    guestCount: i.guestCount,
    budgetCents: i.budgetCents,
    budgetIsPerPerson: i.budgetIsPerPerson,
    foodPreferences: i.foodPreferences,
    dietaryNeeds: i.dietaryNeeds,
    avRequirements: i.avRequirements,
    privacyRequirement: i.privacyRequirement,
    specialRequests: i.specialRequests,
  };
}

function venueBrief(c: OpsInquiry["candidates"][number]): VenueBrief {
  const r = c.space.location.restaurant;
  return { restaurantName: r.name, spaceName: c.space.name, eventsContactName: r.eventsContactName, neighborhood: c.space.location.neighborhood?.name ?? null, knownMinimumCents: c.space.fbMinimumCents, knownRoomFeeCents: c.space.roomFeeCents, maxSeated: c.space.maxSeated, privacy: c.space.privacy };
}

async function load(inquiryId: string) {
  const i = await getInquiryForOps(inquiryId);
  if (!i) throw new Error("Inquiry not found");
  return i;
}

const path = (id: string) => `/admin/inquiries/${id}`;

export async function updateInquiryStatus(formData: FormData) {
  const user = await requireRole("ops");
  const id = fd.str(formData, "inquiryId")!;
  const to = fd.str(formData, "status") as InquiryStatus;
  await setInquiryStatus(id, to, user.id, fd.str(formData, "note") ?? undefined);
  revalidatePath(path(id));
}

export async function assignInquiry(formData: FormData) {
  await requireRole("ops");
  const id = fd.str(formData, "inquiryId")!;
  await db.update(inquiries).set({ assignedToUserId: fd.str(formData, "userId"), updatedAt: new Date() }).where(eq(inquiries.id, id));
  revalidatePath(path(id));
}

export async function saveInternalNotes(formData: FormData) {
  await requireRole("ops");
  const id = fd.str(formData, "inquiryId")!;
  await db.update(inquiries).set({ internalNotes: fd.str(formData, "internalNotes"), updatedAt: new Date() }).where(eq(inquiries.id, id));
  revalidatePath(path(id));
}

export async function updateCandidate(formData: FormData) {
  const user = await requireRole("ops");
  const id = fd.str(formData, "candidateId")!;
  const inquiryId = fd.str(formData, "inquiryId")!;
  const status = fd.str(formData, "status") as CandidateStatus;
  await setCandidateStatus(id, status, user.id, { declineReason: fd.str(formData, "declineReason"), notes: fd.str(formData, "notes"), nextFollowUpAt: fd.date(formData, "nextFollowUpAt") });
  revalidatePath(path(inquiryId));
}

export async function logEvent(formData: FormData) {
  const user = await requireRole("ops");
  const inquiryId = fd.str(formData, "inquiryId")!;
  const kind = (fd.str(formData, "kind") as TimelineKind | null) ?? "note";
  const candidateId = fd.str(formData, "candidateId");
  const actorType = kind === "email_in" || kind === "phone_call" ? "venue" : "ops";
  await addInquiryEvent({ inquiryId, candidateId, kind, actorType: kind === "email_in" ? "venue" : actorType, actorUserId: user.id, subject: fd.str(formData, "subject"), body: fd.str(formData, "body"), occurredAt: fd.date(formData, "occurredAt") ?? new Date() });
  if (candidateId && (kind === "email_out" || kind === "phone_call")) {
    const c = await db.query.inquiryCandidates.findFirst({ where: eq(inquiryCandidates.id, candidateId) });
    if (c && c.status === "not_contacted") await setCandidateStatus(candidateId, "contacted", user.id);
    else await db.update(inquiryCandidates).set({ lastContactAt: new Date() }).where(eq(inquiryCandidates.id, candidateId));
  }
  revalidatePath(path(inquiryId));
}

export async function addCandidate(formData: FormData) {
  await requireRole("ops");
  const inquiryId = fd.str(formData, "inquiryId")!;
  const spaceId = fd.str(formData, "spaceId");
  if (spaceId) await addCandidateSpaces(inquiryId, [spaceId]);
  revalidatePath(path(inquiryId));
}

export async function recordQuote(formData: FormData) {
  const user = await requireRole("ops");
  const inquiryId = fd.str(formData, "inquiryId")!;
  const candidateId = fd.str(formData, "candidateId")!;
  const i = await load(inquiryId);
  const guestCount = fd.int(formData, "guestCount") ?? i.guestCount;
  const input = {
    guestCount,
    fbMinimumCents: fd.money(formData, "fbMinimum"),
    roomFeeCents: fd.money(formData, "roomFee"),
    perPersonCents: fd.money(formData, "perPerson"),
    serviceChargePct: fd.pct(formData, "serviceChargePct") != null ? Number(fd.pct(formData, "serviceChargePct")) : null,
    adminFeePct: fd.pct(formData, "adminFeePct") != null ? Number(fd.pct(formData, "adminFeePct")) : null,
    taxPct: fd.pct(formData, "taxPct") != null ? Number(fd.pct(formData, "taxPct")) : null,
    depositCents: fd.money(formData, "deposit"),
    minimumIncludesRoomFee: fd.bool(formData, "minimumIncludesRoomFee"),
    minimumIncludesServiceAndTax: fd.bool(formData, "minimumIncludesServiceAndTax"),
  };
  const normalized = normalizeQuote(input, { defaultTaxPct: cityDefaultTaxPct("houston") });
  await db.update(quotes).set({ isCurrent: false }).where(and(eq(quotes.candidateId, candidateId), eq(quotes.isCurrent, true)));
  await db.insert(quotes).values({
    inquiryId,
    candidateId,
    rawText: fd.str(formData, "rawText"),
    guestCount,
    fbMinimumCents: input.fbMinimumCents,
    roomFeeCents: input.roomFeeCents,
    perPersonCents: input.perPersonCents,
    serviceChargePct: input.serviceChargePct != null ? String(input.serviceChargePct) : null,
    adminFeePct: input.adminFeePct != null ? String(input.adminFeePct) : null,
    taxPct: input.taxPct != null ? String(input.taxPct) : null,
    depositCents: input.depositCents,
    minimumIncludesRoomFee: input.minimumIncludesRoomFee,
    minimumIncludesServiceAndTax: input.minimumIncludesServiceAndTax,
    inclusions: fd.str(formData, "inclusions"),
    cancellationTerms: fd.str(formData, "cancellationTerms"),
    normalized: normalized as unknown as Record<string, unknown>,
    assumptions: normalized.assumptions,
    createdByUserId: user.id,
  });
  await addInquiryEvent({ inquiryId, candidateId, kind: "quote", actorUserId: user.id, subject: `Quote recorded — est. all-in ${normalized.allInCents != null ? `$${(normalized.allInCents / 100).toLocaleString()}` : "unknown"}`, body: fd.str(formData, "rawText"), metadata: { normalized: normalized as unknown as Record<string, unknown> } });
  const c = await db.query.inquiryCandidates.findFirst({ where: eq(inquiryCandidates.id, candidateId) });
  if (c && !["customer_selected", "customer_rejected", "unavailable"].includes(c.status)) await setCandidateStatus(candidateId, "quote_received", user.id);
  revalidatePath(path(inquiryId));
}

/* ------------------------------------------------------------- AI assist */

export async function generateOutreachDraft(formData: FormData) {
  await requireRole("ops");
  const inquiryId = fd.str(formData, "inquiryId")!;
  const candidateId = fd.str(formData, "candidateId")!;
  const i = await load(inquiryId);
  const c = i.candidates.find((x) => x.id === candidateId);
  if (!c) throw new Error("Candidate not found");
  const { draft, meta } = await draftVenueOutreach(brief(i), venueBrief(c));
  await db.insert(aiDrafts).values({ inquiryId, candidateId, kind: "venue_outreach", subject: draft.subject, content: draft.body, model: meta.model ?? "template", structured: meta.error ? { error: meta.error } : null });
  revalidatePath(path(inquiryId));
}

export async function summarizeReply(formData: FormData) {
  const user = await requireRole("ops");
  const inquiryId = fd.str(formData, "inquiryId")!;
  const candidateId = fd.str(formData, "candidateId")!;
  const text = fd.str(formData, "text");
  if (!text) return;
  const i = await load(inquiryId);
  const c = i.candidates.find((x) => x.id === candidateId);
  if (!c) throw new Error("Candidate not found");
  await addInquiryEvent({ inquiryId, candidateId, kind: "email_in", actorType: "venue", actorUserId: user.id, subject: `Reply from ${c.space.location.restaurant.name}`, body: text });
  const { summary, meta } = await summarizeVenueResponse(text, brief(i), venueBrief(c));
  await db.insert(aiDrafts).values({
    inquiryId,
    candidateId,
    kind: "response_summary",
    subject: `Summary: ${c.space.location.restaurant.name} — ${summary.availability}`,
    content: [summary.summary, "", summary.unansweredQuestions.length ? `Unanswered: ${summary.unansweredQuestions.join("; ")}` : "All questions answered.", summary.suggestedFollowUps.length ? `Suggested follow-ups: ${summary.suggestedFollowUps.join(" | ")}` : ""].filter((l) => l !== "").join("\n"),
    structured: summary as unknown as Record<string, unknown>,
    model: meta.model ?? "rules",
    status: "approved",
  });
  await addInquiryEvent({ inquiryId, candidateId, kind: "ai_summary", actorType: "ai", subject: `AI read: ${summary.availability}${summary.quote.fbMinimumCents != null ? `, min $${summary.quote.fbMinimumCents / 100}` : ""}${summary.quote.perPersonCents != null ? `, $${summary.quote.perPersonCents / 100}/pp` : ""}`, body: summary.summary, metadata: { suggestedStatus: summary.suggestedCandidateStatus, unanswered: summary.unansweredQuestions } });
  revalidatePath(path(inquiryId));
}

/** Apply an AI summary: set candidate status and record the extracted quote. */
export async function applySummary(formData: FormData) {
  const user = await requireRole("ops");
  const inquiryId = fd.str(formData, "inquiryId")!;
  const draftId = fd.str(formData, "draftId")!;
  const draft = await db.query.aiDrafts.findFirst({ where: eq(aiDrafts.id, draftId) });
  if (!draft?.structured || !draft.candidateId) return;
  const s = draft.structured as unknown as { suggestedCandidateStatus: CandidateStatus; quote: Record<string, number | boolean | string | null>; capacityConfirmed: number | null };
  const i = await load(inquiryId);
  const q = s.quote;
  const hasPricing = q.fbMinimumCents != null || q.perPersonCents != null || q.roomFeeCents != null;
  if (hasPricing) {
    const normalized = normalizeQuote(
      { guestCount: i.guestCount, fbMinimumCents: q.fbMinimumCents as number | null, roomFeeCents: q.roomFeeCents as number | null, perPersonCents: q.perPersonCents as number | null, serviceChargePct: q.serviceChargePct as number | null, adminFeePct: q.adminFeePct as number | null, taxPct: q.taxPct as number | null, depositCents: q.depositCents as number | null, minimumIncludesRoomFee: q.minimumIncludesRoomFee as boolean | null, minimumIncludesServiceAndTax: q.minimumIncludesServiceAndTax as boolean | null },
      { defaultTaxPct: cityDefaultTaxPct("houston") },
    );
    await db.update(quotes).set({ isCurrent: false }).where(and(eq(quotes.candidateId, draft.candidateId), eq(quotes.isCurrent, true)));
    await db.insert(quotes).values({
      inquiryId,
      candidateId: draft.candidateId,
      rawText: draft.content,
      guestCount: i.guestCount,
      fbMinimumCents: q.fbMinimumCents as number | null,
      roomFeeCents: q.roomFeeCents as number | null,
      perPersonCents: q.perPersonCents as number | null,
      serviceChargePct: q.serviceChargePct != null ? String(q.serviceChargePct) : null,
      adminFeePct: q.adminFeePct != null ? String(q.adminFeePct) : null,
      taxPct: q.taxPct != null ? String(q.taxPct) : null,
      depositCents: q.depositCents as number | null,
      minimumIncludesRoomFee: q.minimumIncludesRoomFee as boolean | null,
      minimumIncludesServiceAndTax: q.minimumIncludesServiceAndTax as boolean | null,
      inclusions: (q.inclusions as string | null) ?? null,
      cancellationTerms: (q.cancellationTerms as string | null) ?? null,
      normalized: normalized as unknown as Record<string, unknown>,
      assumptions: normalized.assumptions,
      createdByUserId: user.id,
    });
  }
  await setCandidateStatus(draft.candidateId, s.suggestedCandidateStatus, user.id);
  await db.update(aiDrafts).set({ status: "sent", sentAt: new Date() }).where(eq(aiDrafts.id, draftId));
  revalidatePath(path(inquiryId));
}

export async function generateCustomerUpdate(formData: FormData) {
  await requireRole("ops");
  const inquiryId = fd.str(formData, "inquiryId")!;
  const i = await load(inquiryId);
  const candidates: CandidateBrief[] = i.candidates.map((c) => ({ ...venueBrief(c), status: c.status, quote: (c.quotes.find((q) => q.isCurrent)?.normalized as NormalizedQuote | undefined) ?? null, notes: c.notes }));
  const { draft, meta } = await draftCustomerUpdate(brief(i), candidates);
  await db.insert(aiDrafts).values({ inquiryId, kind: "customer_update", subject: draft.subject, content: draft.body, model: meta.model ?? "template", structured: meta.error ? { error: meta.error } : null });
  revalidatePath(path(inquiryId));
}

export async function reviewDraft(formData: FormData) {
  const user = await requireRole("ops");
  const inquiryId = fd.str(formData, "inquiryId")!;
  const draftId = fd.str(formData, "draftId")!;
  const decision = fd.str(formData, "decision");
  const subject = fd.str(formData, "subject");
  const content = fd.str(formData, "content");
  const draft = await db.query.aiDrafts.findFirst({ where: eq(aiDrafts.id, draftId) });
  if (!draft) return;
  if (decision === "reject") {
    await db.update(aiDrafts).set({ status: "rejected" }).where(eq(aiDrafts.id, draftId));
  } else if (decision === "approve_send" || decision === "approve") {
    // Human approval is the gate for anything leaving Red Rope.
    await db.update(aiDrafts).set({ status: "approved", subject: subject ?? draft.subject, content: content ?? draft.content, approvedByUserId: user.id, approvedAt: new Date() }).where(eq(aiDrafts.id, draftId));
    if (decision === "approve_send") {
      const i = await load(inquiryId);
      let to: string | null = null;
      let kind: TimelineKind = "email_out";
      if (draft.kind === "customer_update") {
        to = i.contactEmail;
        kind = "customer_update";
      } else if (draft.candidateId) {
        const c = i.candidates.find((x) => x.id === draft.candidateId);
        to = c?.space.location.restaurant.eventsContactEmail ?? null;
      }
      let sent = false;
      if (to) {
        const res = await sendEmail({ to, subject: subject ?? draft.subject ?? "Red Rope", text: content ?? draft.content, replyTo: process.env.EMAIL_REPLY_TO });
        sent = res.ok;
      }
      await db.update(aiDrafts).set({ status: "sent", sentAt: new Date() }).where(eq(aiDrafts.id, draftId));
      await addInquiryEvent({ inquiryId, candidateId: draft.candidateId, kind, actorUserId: user.id, subject: subject ?? draft.subject, body: content ?? draft.content, metadata: { to, sent, viaDraft: draftId, deliveredBy: sent ? "email_provider" : "manual" } });
      if (draft.candidateId) {
        const c = await db.query.inquiryCandidates.findFirst({ where: eq(inquiryCandidates.id, draft.candidateId) });
        if (c?.status === "not_contacted") await setCandidateStatus(draft.candidateId, "contacted", user.id);
        else await db.update(inquiryCandidates).set({ lastContactAt: new Date() }).where(eq(inquiryCandidates.id, draft.candidateId));
      }
    }
  }
  revalidatePath(path(inquiryId));
}

export async function requestDeposit(formData: FormData) {
  const user = await requireRole("ops");
  const inquiryId = fd.str(formData, "inquiryId")!;
  const amount = fd.money(formData, "amount");
  if (!amount) return;
  await createDepositRequest(inquiryId, amount, fd.str(formData, "description") ?? "Red Rope booking deposit", user.id);
  revalidatePath(path(inquiryId));
}

export async function getQuoteComparison(inquiryId: string) {
  const i = await load(inquiryId);
  const rows = i.candidates
    .map((c) => ({ candidateId: c.id, restaurantName: c.space.location.restaurant.name, spaceName: c.space.name, normalized: c.quotes.find((q) => q.isCurrent)?.normalized as NormalizedQuote | undefined }))
    .filter((r): r is typeof r & { normalized: NormalizedQuote } => !!r.normalized);
  return compareQuotes(rows, i.budgetCents ? (i.budgetIsPerPerson ? i.budgetCents * i.guestCount : i.budgetCents) : null, i.guestCount);
}
