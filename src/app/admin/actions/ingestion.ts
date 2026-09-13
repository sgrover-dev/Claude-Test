"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/auth/session";
import { getCityBySlug } from "@/lib/data/cities";
import { fd } from "@/lib/forms";
import { approveCandidate, createJob, rejectCandidate, runCsvJob, runPdfJob, runTextJob, runUrlJob } from "@/lib/ingestion/jobs";
import type { InventoryPayload, SpacePayload } from "@/lib/ingestion/types";
import { DEFAULT_CITY } from "@/lib/search/types";

async function cityId() {
  const city = await getCityBySlug(DEFAULT_CITY);
  if (!city) throw new Error("Default city missing; run the seed.");
  return city.id;
}

export async function startUrlJob(formData: FormData) {
  const user = await requireRole("ops");
  const url = fd.str(formData, "url");
  if (!url) return;
  const job = await createJob({ source: "url", inputUrl: url, inputLabel: url, createdByUserId: user.id });
  try {
    await runUrlJob(job.id, url, await cityId());
  } catch {
    // Job status already recorded as failed.
  }
  revalidatePath("/admin/ingestion");
  redirect(`/admin/ingestion/${job.id}`);
}

export async function startTextJob(formData: FormData) {
  const user = await requireRole("ops");
  const text = fd.str(formData, "text");
  if (!text) return;
  const title = fd.str(formData, "title");
  const sourceUrl = fd.str(formData, "sourceUrl");
  const job = await createJob({ source: "ai_web", inputLabel: title ?? "Pasted text", inputUrl: sourceUrl, createdByUserId: user.id });
  try {
    await runTextJob(job.id, text, await cityId(), { title, sourceUrl });
  } catch {}
  revalidatePath("/admin/ingestion");
  redirect(`/admin/ingestion/${job.id}`);
}

export async function startFileJob(formData: FormData) {
  const user = await requireRole("ops");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  const buf = Buffer.from(await file.arrayBuffer());
  const isCsv = /\.csv$/i.test(file.name) || /csv/.test(file.type);
  const job = await createJob({ source: isCsv ? "csv" : "pdf", inputLabel: file.name, createdByUserId: user.id });
  try {
    if (isCsv) await runCsvJob(job.id, buf.toString("utf8"), await cityId(), { applyDirectly: fd.bool(formData, "applyDirectly"), createdByUserId: user.id });
    else await runPdfJob(job.id, buf, await cityId(), { title: file.name.replace(/\.pdf$/i, ""), sourceUrl: fd.str(formData, "sourceUrl") });
  } catch {}
  revalidatePath("/admin/ingestion");
  redirect(`/admin/ingestion/${job.id}`);
}

/** Reads the edited review form back into a payload. */
function payloadFromForm(formData: FormData, original: InventoryPayload): InventoryPayload {
  const spaces: SpacePayload[] = [];
  const count = fd.int(formData, "spaceCount") ?? 0;
  for (let i = 0; i < count; i++) {
    if (!fd.bool(formData, `s${i}.include`)) continue;
    const orig = original.spaces[i] ?? { name: "" };
    spaces.push({
      ...orig,
      name: fd.str(formData, `s${i}.name`) ?? orig.name,
      spaceType: (fd.str(formData, `s${i}.spaceType`) as SpacePayload["spaceType"]) ?? orig.spaceType,
      privacy: (fd.str(formData, `s${i}.privacy`) as SpacePayload["privacy"]) ?? null,
      minGuests: fd.int(formData, `s${i}.minGuests`),
      maxSeated: fd.int(formData, `s${i}.maxSeated`),
      maxStanding: fd.int(formData, `s${i}.maxStanding`),
      fbMinimumCents: fd.money(formData, `s${i}.fbMinimum`),
      roomFeeCents: fd.money(formData, `s${i}.roomFee`),
      estPerPersonLowCents: fd.money(formData, `s${i}.perPersonLow`),
      estPerPersonHighCents: fd.money(formData, `s${i}.perPersonHigh`),
      depositCents: fd.money(formData, `s${i}.deposit`),
      description: fd.str(formData, `s${i}.description`) ?? orig.description,
    });
  }
  return {
    ...original,
    restaurant: {
      ...original.restaurant,
      name: fd.str(formData, "restaurant.name") ?? original.restaurant.name,
      eventsPageUrl: fd.str(formData, "restaurant.eventsPageUrl") ?? original.restaurant.eventsPageUrl,
      websiteUrl: fd.str(formData, "restaurant.websiteUrl") ?? original.restaurant.websiteUrl,
      eventsContactName: fd.str(formData, "restaurant.eventsContactName") ?? original.restaurant.eventsContactName,
      eventsContactEmail: fd.str(formData, "restaurant.eventsContactEmail") ?? original.restaurant.eventsContactEmail,
      eventsContactPhone: fd.str(formData, "restaurant.eventsContactPhone") ?? original.restaurant.eventsContactPhone,
      phone: fd.str(formData, "restaurant.phone") ?? original.restaurant.phone,
      cuisines: fd.arr(formData, "restaurant.cuisines").length ? fd.arr(formData, "restaurant.cuisines") : original.restaurant.cuisines,
    },
    location: {
      ...original.location,
      neighborhoodSlug: fd.str(formData, "location.neighborhoodSlug") ?? original.location.neighborhoodSlug,
      addressLine1: fd.str(formData, "location.addressLine1") ?? original.location.addressLine1,
      cityName: fd.str(formData, "location.cityName") ?? original.location.cityName,
      state: fd.str(formData, "location.state") ?? original.location.state,
      postalCode: fd.str(formData, "location.postalCode") ?? original.location.postalCode,
    },
    spaces,
  };
}

export async function reviewCandidate(formData: FormData) {
  const user = await requireRole("ops");
  const candidateId = fd.str(formData, "candidateId")!;
  const decision = fd.str(formData, "decision");
  const candidate = await db.query.extractionCandidates.findFirst({ where: eq(schema.extractionCandidates.id, candidateId) });
  if (!candidate) throw new Error("Candidate not found");
  if (decision === "reject") {
    await rejectCandidate(candidateId, user.id, fd.str(formData, "notes"));
  } else {
    const payload = payloadFromForm(formData, candidate.payload as unknown as InventoryPayload);
    await approveCandidate(candidateId, payload, { cityId: await cityId(), reviewerId: user.id, status: decision === "approve_draft" ? "draft" : "active", notes: fd.str(formData, "notes") });
  }
  revalidatePath(`/admin/ingestion/${candidate.jobId}`);
  revalidatePath("/admin/ingestion");
  revalidatePath("/admin/spaces");
}
