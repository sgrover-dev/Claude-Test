import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { formatCents, formatDate, formatTime } from "@/lib/format";
import { normalizeQuote, type NormalizedQuote } from "@/lib/quotes/normalize";
import { parseQuoteText } from "@/lib/quotes/parse";
import { EVENT_TYPES, labelFor } from "@/lib/taxonomy";
import { AI_MODEL, describeError, getAnthropic, type AiMeta } from "./client";
import { DraftEmailSchema, VenueResponseSummarySchema, type DraftEmail, type VenueResponseSummary } from "./schemas";

/** Minimal inquiry shape the assistants need; keeps them decoupled from the DB. */
export type InquiryBrief = {
  number: number;
  contactName: string;
  eventType: string | null;
  eventDate: string | null;
  startTime: string | null;
  timeFlexibility: string | null;
  durationMinutes: number | null;
  guestCount: number;
  budgetCents: number | null;
  budgetIsPerPerson: boolean;
  foodPreferences: string | null;
  dietaryNeeds: string | null;
  avRequirements: string | null;
  privacyRequirement: string | null;
  specialRequests: string | null;
};

export type VenueBrief = {
  restaurantName: string;
  spaceName: string;
  eventsContactName: string | null;
  neighborhood: string | null;
  knownMinimumCents: number | null;
  knownRoomFeeCents: number | null;
  maxSeated: number | null;
  privacy: string | null;
};

export type CandidateBrief = VenueBrief & {
  status: string;
  quote: NormalizedQuote | null;
  notes: string | null;
};

const OPS_SIGNATURE = "\n\nBest,\nRed Rope Concierge\nconcierge@redrope.co";

function describeInquiry(i: InquiryBrief) {
  const lines = [
    `Event: ${labelFor(EVENT_TYPES, i.eventType) || "Group event"}`,
    `Date: ${i.eventDate ? formatDate(i.eventDate, { weekday: "long" }) : "flexible"}${i.startTime ? ` at ${formatTime(i.startTime)}` : ""}${i.timeFlexibility ? ` (${i.timeFlexibility})` : ""}`,
    `Guests: ${i.guestCount}`,
    i.durationMinutes ? `Duration: ~${Math.round(i.durationMinutes / 60 * 10) / 10} hours` : null,
    i.budgetCents ? `Budget: ${formatCents(i.budgetCents)}${i.budgetIsPerPerson ? " per person" : " total"}` : null,
    i.privacyRequirement ? `Privacy: ${i.privacyRequirement.replace(/_/g, " ")}` : null,
    i.avRequirements ? `AV: ${i.avRequirements}` : null,
    i.foodPreferences ? `Food: ${i.foodPreferences}` : null,
    i.dietaryNeeds ? `Dietary: ${i.dietaryNeeds}` : null,
    i.specialRequests ? `Notes: ${i.specialRequests}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

/* ------------------------------------------------------------------------- */
/* Venue outreach                                                            */
/* ------------------------------------------------------------------------- */

export function outreachTemplate(i: InquiryBrief, v: VenueBrief): DraftEmail {
  const greeting = v.eventsContactName ? `Hi ${v.eventsContactName.split(" ")[0]},` : `Hello ${v.restaurantName} events team,`;
  const when = i.eventDate ? `on ${formatDate(i.eventDate, { weekday: "long" })}${i.startTime ? ` around ${formatTime(i.startTime)}` : ""}` : "on a flexible date";
  const body = `${greeting}

I'm reaching out from Red Rope on behalf of a client who would like to host a ${labelFor(EVENT_TYPES, i.eventType).toLowerCase() || "group event"} for ${i.guestCount} guests ${when}. ${v.spaceName} looks like a great fit.

Could you let us know:
1. Is ${v.spaceName} available ${when}?
2. What is the food & beverage minimum or room fee for that date and time?
3. Is a deposit required, and what are the cancellation terms?
4. Do you add a service charge or administrative fee? (We assume tax is additional.)
5. Which menus would you recommend for this group size${i.dietaryNeeds ? `, keeping in mind: ${i.dietaryNeeds}` : ""}?
${i.avRequirements ? `6. Can the room support: ${i.avRequirements}?\n` : ""}${i.privacyRequirement ? `${i.avRequirements ? 7 : 6}. Is the space ${i.privacyRequirement.replace(/_/g, " ")} for the duration of the event?\n` : ""}
Details for reference:
${describeInquiry(i)}

Red Rope handles the coordination so you'll have one point of contact. Happy to jump on a quick call if easier.${OPS_SIGNATURE}`;
  return { subject: `Private event inquiry — ${i.guestCount} guests, ${i.eventDate ? formatDate(i.eventDate) : "date flexible"} (Red Rope)`, body };
}

export async function draftVenueOutreach(i: InquiryBrief, v: VenueBrief): Promise<{ draft: DraftEmail; meta: AiMeta & { error?: string } }> {
  const client = getAnthropic();
  if (!client) return { draft: outreachTemplate(i, v), meta: { provider: "fallback", model: null } };
  try {
    const response = await client.messages.parse({
      model: AI_MODEL,
      max_tokens: 3000,
      output_config: { format: zodOutputFormat(DraftEmailSchema), effort: "low" },
      system: `You write concise, warm, professional outreach emails from Red Rope (a concierge that books restaurant event spaces on behalf of clients) to restaurant events managers. Ask only for what is unknown. Numbered questions. Never promise the client will book. Never invent facts. Sign as "Red Rope Concierge". Keep under 220 words.`,
      messages: [
        {
          role: "user",
          content: `Client request:\n${describeInquiry(i)}\n\nVenue: ${v.restaurantName} — ${v.spaceName}${v.neighborhood ? ` (${v.neighborhood})` : ""}\nContact name: ${v.eventsContactName ?? "unknown"}\nAlready known: ${[
            v.knownMinimumCents != null ? `F&B minimum ${formatCents(v.knownMinimumCents)}` : null,
            v.knownRoomFeeCents != null ? `room fee ${formatCents(v.knownRoomFeeCents)}` : null,
            v.maxSeated != null ? `seats ${v.maxSeated}` : null,
            v.privacy ? `privacy: ${v.privacy}` : null,
          ].filter(Boolean).join("; ") || "nothing"}\n\nDraft the outreach email.`,
        },
      ],
    });
    if (response.stop_reason !== "refusal" && response.parsed_output) {
      return { draft: response.parsed_output, meta: { provider: "anthropic", model: AI_MODEL } };
    }
    return { draft: outreachTemplate(i, v), meta: { provider: "fallback", model: null, error: "Model declined; used template." } };
  } catch (error) {
    return { draft: outreachTemplate(i, v), meta: { provider: "fallback", model: null, error: describeError(error) } };
  }
}

/* ------------------------------------------------------------------------- */
/* Venue response summary                                                    */
/* ------------------------------------------------------------------------- */

const STANDARD_QUESTIONS: { key: keyof VenueResponseSummary["quote"] | "availability" | "capacity"; question: string }[] = [
  { key: "availability", question: "Is the space available on the requested date and time?" },
  { key: "fbMinimumCents", question: "What is the food & beverage minimum?" },
  { key: "roomFeeCents", question: "Is there a room or rental fee?" },
  { key: "serviceChargePct", question: "What service charge or gratuity is added?" },
  { key: "taxPct", question: "Is tax additional, and at what rate?" },
  { key: "depositCents", question: "Is a deposit required to hold the date?" },
  { key: "cancellationTerms", question: "What are the cancellation terms?" },
];

export function summarizeVenueResponseFallback(text: string, guestCount: number): VenueResponseSummary {
  const lower = text.toLowerCase();
  const parsed = parseQuoteText(text, guestCount);
  let availability: VenueResponseSummary["availability"] = "unclear";
  if (/not available|unavailable|already booked|fully booked|can'?t accommodate|unable to|no availability|booked that (?:night|evening|date)/.test(lower)) availability = "unavailable";
  else if (/tentative|hold|pencil/.test(lower)) availability = "tentative";
  else if (/\bavailable\b|we can host|happy to host|we'd love to host|works for us|is open/.test(lower)) availability = "available";

  const quote: VenueResponseSummary["quote"] = {
    fbMinimumCents: parsed.fbMinimumCents ?? null,
    roomFeeCents: parsed.roomFeeCents ?? null,
    perPersonCents: parsed.perPersonCents ?? null,
    serviceChargePct: parsed.serviceChargePct ?? null,
    adminFeePct: parsed.adminFeePct ?? null,
    taxPct: parsed.taxPct ?? null,
    depositCents: parsed.depositCents ?? null,
    minimumIncludesRoomFee: parsed.minimumIncludesRoomFee ?? null,
    minimumIncludesServiceAndTax: parsed.minimumIncludesServiceAndTax ?? null,
    inclusions: null,
    cancellationTerms: /cancel/.test(lower) ? sentenceWith(text, /cancel/i) : null,
  };
  const hasPricing = quote.fbMinimumCents != null || quote.perPersonCents != null || quote.roomFeeCents != null;
  const unanswered = STANDARD_QUESTIONS.filter((q) => {
    if (q.key === "availability") return availability === "unclear";
    if (q.key === "capacity") return false;
    return quote[q.key] == null;
  }).map((q) => q.question);

  const status: VenueResponseSummary["suggestedCandidateStatus"] =
    availability === "unavailable" ? "unavailable" : hasPricing ? "quote_received" : availability === "available" ? "available" : unanswered.length ? "needs_clarification" : "contacted";

  const summaryBits = [
    availability === "unavailable" ? "Venue is unavailable." : availability === "available" ? "Venue is available." : availability === "tentative" ? "Venue can tentatively hold the date." : "Availability not stated.",
    quote.fbMinimumCents != null ? `F&B minimum ${formatCents(quote.fbMinimumCents)}.` : null,
    quote.perPersonCents != null ? `${formatCents(quote.perPersonCents)}/person.` : null,
    quote.roomFeeCents != null ? `Room fee ${formatCents(quote.roomFeeCents)}.` : null,
    quote.serviceChargePct != null ? `${quote.serviceChargePct}% service.` : null,
    quote.depositCents != null ? `Deposit ${formatCents(quote.depositCents)}.` : null,
  ].filter(Boolean);

  return {
    summary: summaryBits.join(" "),
    availability,
    quote,
    capacityConfirmed: null,
    avConfirmed: /(?:projector|screen|tv|av)\b.*(?:yes|available|have|included)/i.test(text) ? true : null,
    privacyConfirmed: null,
    unansweredQuestions: unanswered,
    suggestedFollowUps: unanswered.slice(0, 3),
    suggestedCandidateStatus: status,
  };
}

function sentenceWith(text: string, re: RegExp): string | null {
  const s = text.split(/(?<=[.!?])\s+/).find((x) => re.test(x));
  return s?.trim() ?? null;
}

export async function summarizeVenueResponse(text: string, i: InquiryBrief, v: VenueBrief): Promise<{ summary: VenueResponseSummary; meta: AiMeta & { error?: string } }> {
  const client = getAnthropic();
  if (!client) return { summary: summarizeVenueResponseFallback(text, i.guestCount), meta: { provider: "fallback", model: null } };
  try {
    const response = await client.messages.parse({
      model: AI_MODEL,
      max_tokens: 4000,
      output_config: { format: zodOutputFormat(VenueResponseSummarySchema), effort: "medium" },
      system: `You are Red Rope's operations analyst. Read a restaurant's reply about a private event and extract facts precisely. Money in integer cents. Use null for anything not stated — never guess. "Inclusive of tax and gratuity" → minimumIncludesServiceAndTax=true. "Plus tax and 20% gratuity" → serviceChargePct=20, minimumIncludesServiceAndTax=false. List every question from our outreach that remains unanswered (availability, minimum/room fee, service charge, tax, deposit, cancellation, capacity, AV, privacy, menus). Suggest at most 4 concise follow-up questions. Choose suggestedCandidateStatus: unavailable if declined; quote_received if any pricing given; available if confirmed but no pricing; needs_clarification if the reply raises questions; otherwise contacted.`,
      messages: [
        {
          role: "user",
          content: `Our request:\n${describeInquiry(i)}\n\nVenue: ${v.restaurantName} — ${v.spaceName}\n\nVenue reply:\n"""\n${text}\n"""`,
        },
      ],
    });
    if (response.stop_reason !== "refusal" && response.parsed_output) {
      return { summary: response.parsed_output, meta: { provider: "anthropic", model: AI_MODEL } };
    }
    return { summary: summarizeVenueResponseFallback(text, i.guestCount), meta: { provider: "fallback", model: null, error: "Model declined; used rule-based summary." } };
  } catch (error) {
    return { summary: summarizeVenueResponseFallback(text, i.guestCount), meta: { provider: "fallback", model: null, error: describeError(error) } };
  }
}

/* ------------------------------------------------------------------------- */
/* Customer update                                                           */
/* ------------------------------------------------------------------------- */

export function customerUpdateTemplate(i: InquiryBrief, candidates: CandidateBrief[]): DraftEmail {
  const ready = candidates.filter((c) => c.status === "quote_received" || c.status === "available");
  const waiting = candidates.filter((c) => ["contacted", "follow_up_due", "needs_clarification", "not_contacted"].includes(c.status));
  const declined = candidates.filter((c) => c.status === "unavailable");
  const lines: string[] = [`Hi ${i.contactName.split(" ")[0]},`, "", `Here's where things stand for your ${labelFor(EVENT_TYPES, i.eventType).toLowerCase() || "event"} for ${i.guestCount}${i.eventDate ? ` on ${formatDate(i.eventDate, { weekday: "long" })}` : ""}:`, ""];
  if (ready.length) {
    lines.push("Options ready:");
    for (const c of ready) {
      const q = c.quote;
      lines.push(
        `• ${c.spaceName} at ${c.restaurantName}${c.neighborhood ? ` (${c.neighborhood})` : ""} — ${
          q?.allInCents != null ? `est. ${formatCents(q.allInCents)} all-in (~${formatCents(q.perPersonCents)}/person)` : "available, pricing to follow"
        }${q?.depositCents != null ? `, ${formatCents(q.depositCents)} deposit` : ""}`,
      );
    }
    lines.push("");
  }
  if (waiting.length) lines.push(`Still waiting on: ${waiting.map((c) => c.restaurantName).join(", ")}.`, "");
  if (declined.length) lines.push(`Not available: ${declined.map((c) => c.restaurantName).join(", ")}.`, "");
  lines.push(ready.length ? "Let me know which you'd like to move forward with, or if you'd like me to keep looking." : "I'll follow up as soon as I hear back.");
  return { subject: `Update on your event (Red Rope #${i.number})`, body: lines.join("\n") + OPS_SIGNATURE };
}

export async function draftCustomerUpdate(i: InquiryBrief, candidates: CandidateBrief[]): Promise<{ draft: DraftEmail; meta: AiMeta & { error?: string } }> {
  const client = getAnthropic();
  if (!client) return { draft: customerUpdateTemplate(i, candidates), meta: { provider: "fallback", model: null } };
  try {
    const response = await client.messages.parse({
      model: AI_MODEL,
      max_tokens: 3000,
      output_config: { format: zodOutputFormat(DraftEmailSchema), effort: "low" },
      system: `You write short, clear status updates from Red Rope to a client who asked us to find a restaurant space. Lead with what's ready, then what's pending. Quote all-in estimates as estimates and note deposits. Never fabricate pricing; only use the numbers provided. Friendly, no fluff, under 200 words. Sign as "Red Rope Concierge".`,
      messages: [
        {
          role: "user",
          content: `Client: ${i.contactName}\nInquiry #${i.number}\n${describeInquiry(i)}\n\nCandidates:\n${candidates
            .map(
              (c) =>
                `- ${c.spaceName} @ ${c.restaurantName} [${c.status}]${c.quote?.allInCents != null ? ` all-in est ${formatCents(c.quote.allInCents)} (${formatCents(c.quote.perPersonCents)}/pp)` : ""}${c.quote?.depositCents != null ? ` deposit ${formatCents(c.quote.depositCents)}` : ""}${c.notes ? ` notes: ${c.notes}` : ""}`,
            )
            .join("\n")}`,
        },
      ],
    });
    if (response.stop_reason !== "refusal" && response.parsed_output) {
      return { draft: response.parsed_output, meta: { provider: "anthropic", model: AI_MODEL } };
    }
    return { draft: customerUpdateTemplate(i, candidates), meta: { provider: "fallback", model: null, error: "Model declined; used template." } };
  } catch (error) {
    return { draft: customerUpdateTemplate(i, candidates), meta: { provider: "fallback", model: null, error: describeError(error) } };
  }
}

/* ------------------------------------------------------------------------- */
/* Quote comparison (deterministic)                                          */
/* ------------------------------------------------------------------------- */

export type QuoteComparisonRow = {
  candidateId: string;
  restaurantName: string;
  spaceName: string;
  normalized: NormalizedQuote;
};

export function compareQuotes(rows: QuoteComparisonRow[], budgetCents: number | null, guestCount: number): { rows: QuoteComparisonRow[]; narrative: string } {
  const sorted = [...rows].sort((a, b) => (a.normalized.allInCents ?? Infinity) - (b.normalized.allInCents ?? Infinity));
  const priced = sorted.filter((r) => r.normalized.allInCents != null);
  if (!priced.length) return { rows: sorted, narrative: "No comparable pricing yet." };
  const cheapest = priced[0];
  const parts = [
    `${cheapest.spaceName} at ${cheapest.restaurantName} is the lowest estimated all-in at ${formatCents(cheapest.normalized.allInCents)} (~${formatCents(cheapest.normalized.perPersonCents)}/person for ${guestCount}).`,
  ];
  if (priced.length > 1) {
    const priciest = priced[priced.length - 1];
    parts.push(`${priciest.spaceName} at ${priciest.restaurantName} is highest at ${formatCents(priciest.normalized.allInCents)}.`);
  }
  if (budgetCents) {
    const within = priced.filter((r) => (r.normalized.allInCents ?? Infinity) <= budgetCents);
    parts.push(within.length ? `${within.length} of ${priced.length} priced options fit the ${formatCents(budgetCents)} budget.` : `None of the priced options fit the ${formatCents(budgetCents)} budget yet.`);
  }
  const assumed = priced.filter((r) => r.normalized.confidence !== "high");
  if (assumed.length) parts.push(`${assumed.length} estimate${assumed.length > 1 ? "s rely" : " relies"} on assumed service charge or tax — confirm before quoting the client.`);
  return { rows: sorted, narrative: parts.join(" ") };
}

export { normalizeQuote };
