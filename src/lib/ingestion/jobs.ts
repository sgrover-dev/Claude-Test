import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { IngestionSource } from "@/db/schema";
import { extractInventory } from "@/lib/ai/extraction";
import type { ExtractedInventory } from "@/lib/ai/schemas";
import { neighborhoodHints } from "@/lib/data/cities";
import { applyInventoryPayload } from "./apply";
import { parseVenueCsv } from "./csv";
import { matchNeighborhood, parseAddress } from "./csv";
import type { InventoryPayload, SpacePayload } from "./types";
import { fetchPageText, pdfToText } from "./web";

const { ingestionJobs, extractionCandidates } = schema;

export async function createJob(input: { source: IngestionSource; inputUrl?: string | null; inputLabel?: string | null; createdByUserId?: string | null; targetRestaurantId?: string | null; rawPayload?: Record<string, unknown> | null }) {
  const [job] = await db.insert(ingestionJobs).values({ source: input.source, inputUrl: input.inputUrl ?? null, inputLabel: input.inputLabel ?? null, createdByUserId: input.createdByUserId ?? null, targetRestaurantId: input.targetRestaurantId ?? null, rawPayload: input.rawPayload ?? null, status: "queued" }).returning();
  return job;
}

async function finishJob(jobId: string, status: "needs_review" | "completed" | "failed", summary: string | null, error?: string | null) {
  await db.update(ingestionJobs).set({ status, summary, error: error ?? null, completedAt: new Date() }).where(eq(ingestionJobs.id, jobId));
}

async function addCandidates(jobId: string, payloads: InventoryPayload[], sourceUrl: string | null, confidence: number | null) {
  if (!payloads.length) return;
  await db.insert(extractionCandidates).values(
    payloads.map((p) => ({
      jobId,
      candidateType: "inventory",
      payload: p as unknown as Record<string, unknown>,
      overallConfidence: confidence != null ? String(confidence) : null,
      sourceUrl,
      fieldConfidence: null,
    })),
  );
}

/** Convert AI/heuristic extraction into the common payload shape. */
export function extractedToPayload(inv: ExtractedInventory, sourceUrl: string | null, neighborhoods: { slug: string; name: string; aliases: string[] }[], fallbackName: string | null): InventoryPayload {
  const name = inv.restaurant.name ?? fallbackName ?? "Unknown restaurant";
  const address = inv.restaurant.addressLine1 ? parseAddress([inv.restaurant.addressLine1, inv.restaurant.cityName, [inv.restaurant.state, inv.restaurant.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", "), {}) : null;
  const rawNeighborhood = inv.notes ?? "";
  const sourceType = sourceUrl && /\.pdf(\?|$)/i.test(sourceUrl) ? ("private_dining_pdf" as const) : ("restaurant_website" as const);
  return {
    restaurant: {
      name,
      description: inv.restaurant.description,
      cuisines: inv.restaurant.cuisines,
      phone: inv.restaurant.phone,
      eventsContactName: inv.restaurant.eventsContactName,
      eventsContactEmail: inv.restaurant.eventsContactEmail,
      eventsContactPhone: inv.restaurant.eventsContactPhone,
      eventsPageUrl: inv.restaurant.eventsPageUrl ?? sourceUrl,
      websiteUrl: sourceUrl ? safeOrigin(sourceUrl) : null,
      documents: inv.restaurant.menuUrls.map((url) => ({ title: "Menu", url, kind: "menu" as const })),
      provenance: sourceUrl ? [{ sourceType: "ai_extraction" as const, sourceUrl, confidence: "publicly_listed" as const, note: "AI-assisted extraction; reviewed by admin" }] : [],
    },
    location: {
      addressLine1: address?.line1 ?? inv.restaurant.addressLine1,
      cityName: address?.city ?? inv.restaurant.cityName,
      state: address?.state ?? inv.restaurant.state,
      postalCode: address?.postalCode ?? inv.restaurant.postalCode,
      neighborhoodSlug: matchNeighborhood(rawNeighborhood, neighborhoods),
    },
    spaces: inv.spaces.map((s) => ({
      name: s.name,
      description: s.description,
      spaceType: s.spaceType as SpacePayload["spaceType"],
      privacy: s.privacy,
      indoorOutdoor: s.indoorOutdoor,
      minGuests: s.minGuests,
      maxSeated: s.maxSeated,
      maxStanding: s.maxStanding,
      roomFeeCents: s.roomFeeCents,
      fbMinimumCents: s.fbMinimumCents,
      estPerPersonLowCents: s.estPerPersonLowCents,
      estPerPersonHighCents: s.estPerPersonHighCents,
      depositCents: s.depositCents,
      serviceChargePct: s.serviceChargePct,
      amenities: s.amenities,
      foodStyles: s.foodStyles,
      availabilityNotes: s.availabilityNotes,
      pricingNotes: s.pricingNotes,
      researchNotes: s.evidence ? `Evidence: ${s.evidence}` : null,
      verificationStatus: sourceUrl ? "publicly_listed" : "unverified",
      lastVerifiedAt: sourceUrl ? new Date() : null,
      confidence: s.confidence,
      provenance: sourceUrl ? [{ sourceType, sourceUrl, confidence: "publicly_listed" as const, note: s.evidence ? `Evidence: ${s.evidence.slice(0, 200)}` : null }] : [],
    })),
    summary: `${name}: ${inv.spaces.length} space${inv.spaces.length === 1 ? "" : "s"} extracted`,
  };
}

function safeOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** URL ingestion: fetch → text → (AI) extraction → review candidates. */
export async function runUrlJob(jobId: string, url: string, cityId: string) {
  await db.update(ingestionJobs).set({ status: "running" }).where(eq(ingestionJobs.id, jobId));
  try {
    const page = await fetchPageText(url);
    const hints = await neighborhoodHints(cityId);
    const { inventory, meta } = await extractInventory(page.text, { title: page.title, url });
    if (page.pdfLinks.length) inventory.restaurant.menuUrls = Array.from(new Set([...inventory.restaurant.menuUrls, ...page.pdfLinks.slice(0, 10)]));
    const payload = extractedToPayload(inventory, url, hints, page.title);
    await db.update(ingestionJobs).set({ rawPayload: { title: page.title, textPreview: page.text.slice(0, 4000), pdfLinks: page.pdfLinks, eventLinks: page.eventLinks, provider: meta.provider, model: meta.model, error: meta.error ?? null } }).where(eq(ingestionJobs.id, jobId));
    await addCandidates(jobId, [payload], url, avg(inventory.spaces.map((s) => s.confidence)));
    await finishJob(jobId, "needs_review", `${payload.spaces.length} space candidate(s) via ${meta.provider}${meta.error ? ` (${meta.error})` : ""}`);
  } catch (e) {
    await finishJob(jobId, "failed", null, e instanceof Error ? e.message : String(e));
    throw e;
  }
}

/** Free text / pasted content or PDF text. */
export async function runTextJob(jobId: string, text: string, cityId: string, opts: { sourceUrl?: string | null; title?: string | null }) {
  await db.update(ingestionJobs).set({ status: "running" }).where(eq(ingestionJobs.id, jobId));
  try {
    const hints = await neighborhoodHints(cityId);
    const { inventory, meta } = await extractInventory(text, { title: opts.title ?? null, url: opts.sourceUrl ?? null });
    const payload = extractedToPayload(inventory, opts.sourceUrl ?? null, hints, opts.title ?? null);
    await db.update(ingestionJobs).set({ rawPayload: { title: opts.title ?? null, textPreview: text.slice(0, 4000), provider: meta.provider, model: meta.model, error: meta.error ?? null } }).where(eq(ingestionJobs.id, jobId));
    await addCandidates(jobId, [payload], opts.sourceUrl ?? null, avg(inventory.spaces.map((s) => s.confidence)));
    await finishJob(jobId, "needs_review", `${payload.spaces.length} space candidate(s) via ${meta.provider}${meta.error ? ` (${meta.error})` : ""}`);
  } catch (e) {
    await finishJob(jobId, "failed", null, e instanceof Error ? e.message : String(e));
    throw e;
  }
}

export async function runPdfJob(jobId: string, buf: Buffer, cityId: string, opts: { sourceUrl?: string | null; title?: string | null }) {
  const text = await pdfToText(buf);
  return runTextJob(jobId, text, cityId, opts);
}

/** CSV ingestion: parse → one candidate per restaurant (review) or apply directly. */
export async function runCsvJob(jobId: string, csvText: string, cityId: string, opts: { applyDirectly?: boolean; createdByUserId?: string | null }) {
  await db.update(ingestionJobs).set({ status: "running" }).where(eq(ingestionJobs.id, jobId));
  try {
    const hints = await neighborhoodHints(cityId);
    const parsed = parseVenueCsv(csvText, hints, { defaultCity: "Houston", defaultState: "TX" });
    await db.update(ingestionJobs).set({ rawPayload: { rowCount: parsed.rowCount, skipped: parsed.skipped, unmappedNeighborhoods: parsed.unmappedNeighborhoods } }).where(eq(ingestionJobs.id, jobId));
    if (opts.applyDirectly) {
      let spacesN = 0;
      for (const p of parsed.payloads) {
        const r = await applyInventoryPayload(p, { cityId, createdByUserId: opts.createdByUserId, preserveExisting: true, defaultProvenance: { sourceType: "csv_import", confidence: "publicly_listed" } });
        spacesN += r.created.spaces + r.updated.spaces;
      }
      await finishJob(jobId, "completed", `${parsed.payloads.length} restaurants, ${spacesN} spaces applied from ${parsed.rowCount} rows`);
    } else {
      await addCandidates(jobId, parsed.payloads, null, 0.8);
      await finishJob(jobId, "needs_review", `${parsed.payloads.length} restaurant candidate(s) from ${parsed.rowCount} rows${parsed.skipped.length ? `; skipped ${parsed.skipped.length}` : ""}`);
    }
    return parsed;
  } catch (e) {
    await finishJob(jobId, "failed", null, e instanceof Error ? e.message : String(e));
    throw e;
  }
}

export async function approveCandidate(candidateId: string, payload: InventoryPayload, opts: { cityId: string; reviewerId: string | null; status: "draft" | "active"; notes?: string | null }) {
  const result = await applyInventoryPayload(payload, { cityId: opts.cityId, createdByUserId: opts.reviewerId, status: opts.status, preserveExisting: false });
  await db.update(extractionCandidates).set({ status: "approved", payload: payload as unknown as Record<string, unknown>, appliedEntityId: result.restaurantId, reviewedByUserId: opts.reviewerId, reviewedAt: new Date(), reviewerNotes: opts.notes ?? null }).where(eq(extractionCandidates.id, candidateId));
  await maybeCompleteJob(candidateId);
  return result;
}

export async function rejectCandidate(candidateId: string, reviewerId: string | null, notes?: string | null) {
  await db.update(extractionCandidates).set({ status: "rejected", reviewedByUserId: reviewerId, reviewedAt: new Date(), reviewerNotes: notes ?? null }).where(eq(extractionCandidates.id, candidateId));
  await maybeCompleteJob(candidateId);
}

async function maybeCompleteJob(candidateId: string) {
  const c = await db.query.extractionCandidates.findFirst({ where: eq(extractionCandidates.id, candidateId) });
  if (!c) return;
  const siblings = await db.query.extractionCandidates.findMany({ where: eq(extractionCandidates.jobId, c.jobId) });
  if (siblings.every((s) => s.status !== "pending")) {
    const approved = siblings.filter((s) => s.status === "approved").length;
    await db.update(ingestionJobs).set({ status: approved ? "completed" : "rejected", completedAt: new Date() }).where(eq(ingestionJobs.id, c.jobId));
  }
}

export async function listJobs(limit = 50) {
  return db.query.ingestionJobs.findMany({ orderBy: [desc(ingestionJobs.createdAt)], limit, with: { candidates: true } });
}

export async function getJob(id: string) {
  return db.query.ingestionJobs.findFirst({ where: eq(ingestionJobs.id, id), with: { candidates: { orderBy: [extractionCandidates.createdAt] } } });
}

function avg(nums: number[]) {
  return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 1000) / 1000 : null;
}
