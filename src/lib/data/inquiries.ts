import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CandidateStatus, InquiryStatus, TimelineKind } from "@/db/schema";
import { canTransition, suggestInquiryStatus } from "@/lib/inquiries/state";

const { inquiries, inquiryCandidates, inquiryEvents, spaces, locations, restaurants, neighborhoods, quotes, aiDrafts, payments } = schema;

export type CreateInquiryInput = {
  userId: string | null;
  cityId: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  company?: string | null;
  eventType?: string | null;
  eventDate?: string | null;
  startTime?: string | null;
  timeFlexibility?: string | null;
  durationMinutes?: number | null;
  guestCount: number;
  budgetCents?: number | null;
  budgetIsPerPerson?: boolean;
  foodPreferences?: string | null;
  dietaryNeeds?: string | null;
  avRequirements?: string | null;
  privacyRequirement?: "fully_private" | "semi_private" | "shared" | "buyout" | null;
  specialRequests?: string | null;
  spaceIds: string[];
  preferredSpaceId?: string | null;
  searchSnapshot?: Record<string, unknown> | null;
  attribution?: Record<string, unknown> | null;
};

export async function createInquiry(input: CreateInquiryInput) {
  return db.transaction(async (tx) => {
    const [inquiry] = await tx
      .insert(inquiries)
      .values({
        userId: input.userId,
        cityId: input.cityId,
        status: "submitted",
        contactName: input.contactName,
        contactEmail: input.contactEmail.toLowerCase(),
        contactPhone: input.contactPhone ?? null,
        company: input.company ?? null,
        eventType: input.eventType ?? null,
        eventDate: input.eventDate ?? null,
        startTime: input.startTime ?? null,
        timeFlexibility: input.timeFlexibility ?? null,
        durationMinutes: input.durationMinutes ?? null,
        guestCount: input.guestCount,
        budgetCents: input.budgetCents ?? null,
        budgetIsPerPerson: input.budgetIsPerPerson ?? false,
        foodPreferences: input.foodPreferences ?? null,
        dietaryNeeds: input.dietaryNeeds ?? null,
        avRequirements: input.avRequirements ?? null,
        privacyRequirement: input.privacyRequirement ?? null,
        specialRequests: input.specialRequests ?? null,
        searchSnapshot: input.searchSnapshot ?? null,
        attribution: input.attribution ?? null,
      })
      .returning();
    if (input.spaceIds.length) {
      await tx.insert(inquiryCandidates).values(
        input.spaceIds.map((spaceId, i) => ({
          inquiryId: inquiry.id,
          spaceId,
          rank: i,
          isPreferred: input.preferredSpaceId ? spaceId === input.preferredSpaceId : i === 0,
        })),
      );
    }
    await tx.insert(inquiryEvents).values({
      inquiryId: inquiry.id,
      kind: "status_change",
      actorType: "customer",
      subject: "Inquiry submitted",
      body: `${input.contactName} submitted a request for ${input.guestCount} guests with ${input.spaceIds.length} candidate space${input.spaceIds.length === 1 ? "" : "s"}.`,
      metadata: { to: "submitted" },
    });
    return inquiry;
  });
}

export const candidateWithSpace = {
  with: {
    space: { with: { location: { with: { restaurant: true, neighborhood: true } }, photos: true } },
    quotes: true,
  },
} as const;

export async function getInquiryForCustomer(id: string, viewer: { userId?: string | null; email?: string | null }) {
  const inquiry = await db.query.inquiries.findFirst({
    where: eq(inquiries.id, id),
    with: {
      candidates: { ...candidateWithSpace, orderBy: [inquiryCandidates.rank] },
      events: { orderBy: [desc(inquiryEvents.occurredAt)] },
      payments: true,
    },
  });
  if (!inquiry) return null;
  const owns = (viewer.userId && inquiry.userId === viewer.userId) || (viewer.email && inquiry.contactEmail === viewer.email.toLowerCase());
  if (!owns) return null;
  // Customers see customer-facing events only.
  const visibleKinds: TimelineKind[] = ["customer_message", "customer_update", "status_change", "deposit_request"];
  return { ...inquiry, events: inquiry.events.filter((e) => visibleKinds.includes(e.kind)) };
}

export async function listInquiriesForUser(userId: string) {
  return db.query.inquiries.findMany({
    where: eq(inquiries.userId, userId),
    orderBy: [desc(inquiries.createdAt)],
    with: { candidates: { with: { space: { with: { location: { with: { restaurant: true } } } } } } },
  });
}

/* ------------------------------------------------------------------ ops */

export async function listInquiriesForOps(filter: { status?: InquiryStatus | "active" | "all"; assignedTo?: string | null; q?: string }) {
  const conds = [];
  if (filter.status === "active" || !filter.status) conds.push(sql`${inquiries.status} not in ('closed','cancelled','draft')`);
  else if (filter.status !== "all") conds.push(eq(inquiries.status, filter.status));
  if (filter.assignedTo) conds.push(eq(inquiries.assignedToUserId, filter.assignedTo));
  if (filter.q) conds.push(sql`(${inquiries.contactName} ilike ${"%" + filter.q + "%"} or ${inquiries.contactEmail} ilike ${"%" + filter.q + "%"} or ${inquiries.number}::text = ${filter.q.replace(/^#/, "")})`);
  return db.query.inquiries.findMany({
    where: conds.length ? and(...conds) : undefined,
    orderBy: [desc(inquiries.updatedAt)],
    with: { candidates: { with: { space: { with: { location: { with: { restaurant: true } } } } } } },
    limit: 200,
  });
}

export async function getInquiryForOps(id: string) {
  return db.query.inquiries.findFirst({
    where: eq(inquiries.id, id),
    with: {
      user: true,
      candidates: { ...candidateWithSpace, orderBy: [inquiryCandidates.rank] },
      events: { orderBy: [desc(inquiryEvents.occurredAt)] },
      quotes: { orderBy: [desc(quotes.createdAt)] },
      aiDrafts: { orderBy: [desc(aiDrafts.createdAt)] },
      payments: { orderBy: [desc(payments.createdAt)] },
    },
  });
}

export type OpsInquiry = NonNullable<Awaited<ReturnType<typeof getInquiryForOps>>>;

export async function addInquiryEvent(input: {
  inquiryId: string;
  candidateId?: string | null;
  kind: TimelineKind;
  actorType?: "ops" | "customer" | "venue" | "ai" | "system";
  actorUserId?: string | null;
  subject?: string | null;
  body?: string | null;
  metadata?: Record<string, unknown> | null;
  occurredAt?: Date;
}) {
  const [row] = await db
    .insert(inquiryEvents)
    .values({
      inquiryId: input.inquiryId,
      candidateId: input.candidateId ?? null,
      kind: input.kind,
      actorType: input.actorType ?? "ops",
      actorUserId: input.actorUserId ?? null,
      subject: input.subject ?? null,
      body: input.body ?? null,
      metadata: input.metadata ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    })
    .returning();
  await db.update(inquiries).set({ updatedAt: new Date() }).where(eq(inquiries.id, input.inquiryId));
  return row;
}

export async function setInquiryStatus(inquiryId: string, to: InquiryStatus, actorUserId: string | null, note?: string) {
  const current = await db.query.inquiries.findFirst({ where: eq(inquiries.id, inquiryId) });
  if (!current) throw new Error("Inquiry not found");
  if (!canTransition(current.status, to)) throw new Error(`Cannot move from ${current.status} to ${to}`);
  if (current.status === to) return current;
  const [updated] = await db
    .update(inquiries)
    .set({ status: to, updatedAt: new Date(), closedAt: to === "closed" || to === "cancelled" ? new Date() : null })
    .where(eq(inquiries.id, inquiryId))
    .returning();
  await addInquiryEvent({ inquiryId, kind: "status_change", actorUserId, subject: `Status → ${to.replace(/_/g, " ")}`, body: note ?? null, metadata: { from: current.status, to } });
  return updated;
}

export async function setCandidateStatus(candidateId: string, status: CandidateStatus, actorUserId: string | null, extra: { declineReason?: string | null; notes?: string | null; nextFollowUpAt?: Date | null } = {}) {
  const candidate = await db.query.inquiryCandidates.findFirst({ where: eq(inquiryCandidates.id, candidateId), with: { space: { with: { location: { with: { restaurant: true } } } } } });
  if (!candidate) throw new Error("Candidate not found");
  const touchesVenue = ["contacted", "follow_up_due"].includes(status);
  const [updated] = await db
    .update(inquiryCandidates)
    .set({
      status,
      declineReason: extra.declineReason ?? candidate.declineReason,
      notes: extra.notes ?? candidate.notes,
      nextFollowUpAt: extra.nextFollowUpAt === undefined ? candidate.nextFollowUpAt : extra.nextFollowUpAt,
      lastContactAt: touchesVenue ? new Date() : candidate.lastContactAt,
      updatedAt: new Date(),
    })
    .where(eq(inquiryCandidates.id, candidateId))
    .returning();
  await addInquiryEvent({
    inquiryId: candidate.inquiryId,
    candidateId,
    kind: "status_change",
    actorUserId,
    subject: `${candidate.space.location.restaurant.name} — ${candidate.space.name}: ${status.replace(/_/g, " ")}`,
    body: extra.declineReason ?? null,
    metadata: { candidateStatus: status },
  });
  // Nudge the inquiry status.
  const all = await db.query.inquiryCandidates.findMany({ where: eq(inquiryCandidates.inquiryId, candidate.inquiryId) });
  const inquiry = await db.query.inquiries.findFirst({ where: eq(inquiries.id, candidate.inquiryId) });
  if (inquiry) {
    const suggested = suggestInquiryStatus(inquiry.status, all.map((c) => c.status));
    if (suggested !== inquiry.status && canTransition(inquiry.status, suggested)) await setInquiryStatus(inquiry.id, suggested, null, "Auto-updated from venue statuses");
  }
  return updated;
}

export async function addCandidateSpaces(inquiryId: string, spaceIds: string[]) {
  const existing = await db.query.inquiryCandidates.findMany({ where: eq(inquiryCandidates.inquiryId, inquiryId) });
  const existingIds = new Set(existing.map((c) => c.spaceId));
  const fresh = spaceIds.filter((id) => !existingIds.has(id));
  if (!fresh.length) return [];
  const rows = await db
    .insert(inquiryCandidates)
    .values(fresh.map((spaceId, i) => ({ inquiryId, spaceId, rank: existing.length + i })))
    .returning();
  const names = await db
    .select({ name: spaces.name, restaurant: restaurants.name })
    .from(spaces)
    .innerJoin(locations, eq(locations.id, spaces.locationId))
    .innerJoin(restaurants, eq(restaurants.id, locations.restaurantId))
    .where(inArray(spaces.id, fresh));
  await addInquiryEvent({ inquiryId, kind: "note", actorType: "ops", subject: "Candidate spaces added", body: names.map((n) => `${n.restaurant} — ${n.name}`).join("\n") });
  return rows;
}

export async function spaceDemandStats(spaceId: string) {
  const [views] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.spaceViews).where(and(eq(schema.spaceViews.spaceId, spaceId), sql`${schema.spaceViews.createdAt} > now() - interval '30 days'`));
  const [inq] = await db.select({ n: sql<number>`count(*)::int` }).from(inquiryCandidates).where(eq(inquiryCandidates.spaceId, spaceId));
  return { views30d: Number(views?.n ?? 0), inquiries: Number(inq?.n ?? 0) };
}

export async function inquiriesForSpace(spaceId: string) {
  return db
    .select({ id: inquiries.id, number: inquiries.number, status: inquiries.status, contactName: inquiries.contactName, eventDate: inquiries.eventDate, guestCount: inquiries.guestCount, candidateStatus: inquiryCandidates.status, createdAt: inquiries.createdAt })
    .from(inquiryCandidates)
    .innerJoin(inquiries, eq(inquiries.id, inquiryCandidates.inquiryId))
    .where(eq(inquiryCandidates.spaceId, spaceId))
    .orderBy(desc(inquiries.createdAt))
    .limit(50);
}

export async function restaurantDemandSummary(restaurantId: string, days = 30) {
  const [row] = await db
    .select({
      views: sql<number>`(select count(*)::int from space_views v join spaces s on s.id = v.space_id join locations l on l.id = s.location_id where l.restaurant_id = ${restaurantId} and v.created_at > now() - (${days} || ' days')::interval)`,
      inquiries: sql<number>`(select count(distinct c.inquiry_id)::int from inquiry_candidates c join spaces s on s.id = c.space_id join locations l on l.id = s.location_id where l.restaurant_id = ${restaurantId} and c.created_at > now() - (${days} || ' days')::interval)`,
      estimatedDemandCents: sql<number>`(select coalesce(sum(coalesce(i.budget_cents, 0) * case when i.budget_is_per_person then i.guest_count else 1 end), 0)::bigint from inquiry_candidates c join inquiries i on i.id = c.inquiry_id join spaces s on s.id = c.space_id join locations l on l.id = s.location_id where l.restaurant_id = ${restaurantId} and c.created_at > now() - (${days} || ' days')::interval)`,
    })
    .from(sql`(select 1) as one`);
  return { views: Number(row?.views ?? 0), inquiries: Number(row?.inquiries ?? 0), estimatedDemandCents: Number(row?.estimatedDemandCents ?? 0) };
}

export { neighborhoods };
