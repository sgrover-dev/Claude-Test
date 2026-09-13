"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { requestMagicLink, isValidEmail } from "@/lib/auth/magic";
import { getCityBySlug } from "@/lib/data/cities";
import { addInquiryEvent, createInquiry, getInquiryForCustomer } from "@/lib/data/inquiries";
import { listSpacesBySlugs } from "@/lib/data/spaces";
import { sendEmail, isDevEmail } from "@/lib/email";
import { DEFAULT_CITY } from "@/lib/search/types";

const Schema = z.object({
  spaces: z.string().min(1),
  preferred: z.string().optional(),
  contactName: z.string().min(2).max(120),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(40).optional(),
  company: z.string().max(120).optional(),
  eventType: z.string().max(60).optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  timeFlexibility: z.string().max(200).optional(),
  durationMinutes: z.coerce.number().int().min(30).max(1440).optional().or(z.literal("")),
  guestCount: z.coerce.number().int().min(1).max(2000),
  budget: z.coerce.number().min(0).optional().or(z.literal("")),
  budgetIsPerPerson: z.string().optional(),
  foodPreferences: z.string().max(1000).optional(),
  dietaryNeeds: z.string().max(1000).optional(),
  avRequirements: z.string().max(1000).optional(),
  privacyRequirement: z.enum(["fully_private", "semi_private", "shared", "buyout", ""]).optional(),
  specialRequests: z.string().max(2000).optional(),
  snapshot: z.string().optional(),
});

export type InquiryFormState = { error?: string; fieldErrors?: Record<string, string> };

export async function submitInquiry(_prev: InquiryFormState, formData: FormData): Promise<InquiryFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { error: "Please check the highlighted fields.", fieldErrors };
  }
  const d = parsed.data;
  const slugs = d.spaces.split(",").map((s) => s.trim()).filter(Boolean);
  const spaces = await listSpacesBySlugs(slugs);
  if (!spaces.length) return { error: "Pick at least one space." };
  const user = await getCurrentUser();
  const city = await getCityBySlug(DEFAULT_CITY);
  const preferred = d.preferred ? spaces.find((s) => s.slug === d.preferred)?.id ?? null : null;
  let snapshot: Record<string, unknown> | null = null;
  try {
    snapshot = d.snapshot ? (JSON.parse(d.snapshot) as Record<string, unknown>) : null;
  } catch {}

  const inquiry = await createInquiry({
    userId: user?.id ?? null,
    cityId: city?.id ?? null,
    contactName: d.contactName,
    contactEmail: d.contactEmail,
    contactPhone: d.contactPhone || null,
    company: d.company || null,
    eventType: d.eventType || null,
    eventDate: d.eventDate || null,
    startTime: d.startTime || null,
    timeFlexibility: d.timeFlexibility || null,
    durationMinutes: typeof d.durationMinutes === "number" ? d.durationMinutes : null,
    guestCount: d.guestCount,
    budgetCents: typeof d.budget === "number" && d.budget > 0 ? Math.round(d.budget * 100) : null,
    budgetIsPerPerson: d.budgetIsPerPerson === "on",
    foodPreferences: d.foodPreferences || null,
    dietaryNeeds: d.dietaryNeeds || null,
    avRequirements: d.avRequirements || null,
    privacyRequirement: d.privacyRequirement || null,
    specialRequests: d.specialRequests || null,
    spaceIds: spaces.map((s) => s.id),
    preferredSpaceId: preferred,
    searchSnapshot: snapshot,
    attribution: { source: "web", path: "/inquire" },
  });

  // Confirmation email + sign-in link so the customer can track progress.
  let devLink: string | undefined;
  if (!user) {
    try {
      const { link } = await requestMagicLink(d.contactEmail, `/account/inquiries/${inquiry.id}`);
      if (isDevEmail()) devLink = link;
    } catch {}
  } else {
    await sendEmail({
      to: d.contactEmail,
      subject: `We're on it — Red Rope inquiry #${inquiry.number}`,
      text: `Hi ${d.contactName.split(" ")[0]},\n\nThanks for your request for ${d.guestCount} guests. We're contacting ${spaces.map((s) => s.restaurantName).join(", ")} now and will update you shortly.\n\nTrack progress: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/account/inquiries/${inquiry.id}\n\n— Red Rope Concierge`,
    });
  }
  redirect(`/inquire/thanks?n=${inquiry.number}&id=${inquiry.id}${devLink ? `&dev=${encodeURIComponent(devLink)}` : ""}`);
}

export async function sendCustomerMessage(inquiryId: string, body: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to message Red Rope." };
  const inquiry = await getInquiryForCustomer(inquiryId, { userId: user.id, email: user.email });
  if (!inquiry) return { error: "Not found" };
  const text = body.trim().slice(0, 4000);
  if (!text) return { error: "Write a message first." };
  await addInquiryEvent({ inquiryId, kind: "customer_message", actorType: "customer", actorUserId: user.id, body: text });
  revalidatePath(`/account/inquiries/${inquiryId}`);
  return { ok: true };
}

export async function selectOption(inquiryId: string, candidateId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  const inquiry = await getInquiryForCustomer(inquiryId, { userId: user.id, email: user.email });
  if (!inquiry) return { error: "Not found" };
  const candidate = inquiry.candidates.find((c) => c.id === candidateId);
  if (!candidate) return { error: "Option not found" };
  const { setCandidateStatus } = await import("@/lib/data/inquiries");
  await setCandidateStatus(candidateId, "customer_selected", null);
  await addInquiryEvent({ inquiryId, kind: "customer_message", actorType: "customer", actorUserId: user.id, subject: "Customer selected an option", body: `Selected ${candidate.space.location.restaurant.name} — ${candidate.space.name}.` });
  revalidatePath(`/account/inquiries/${inquiryId}`);
  return { ok: true };
}

export { isValidEmail };
