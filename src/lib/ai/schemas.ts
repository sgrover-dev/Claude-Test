import { z } from "zod";
import { AMBIANCE, AMENITIES, CUISINES, EVENT_TYPES, FOOD_STYLES, SPACE_TYPES } from "@/lib/taxonomy";

const keys = <T extends readonly { key: string }[]>(o: T) => o.map((x) => x.key) as [string, ...string[]];

export const PrivacyEnum = z.enum(["fully_private", "semi_private", "shared", "buyout"]);
export const IndoorOutdoorEnum = z.enum(["indoor", "outdoor", "covered_outdoor", "mixed"]);

/** What the concierge extracts from a natural-language request. */
export const InterpretedRequestSchema = z.object({
  summary: z.string().describe("One sentence restating the request in Red Rope's words."),
  neighborhood: z.string().nullable().describe("Neighborhood slug from the provided list, or null."),
  date: z.string().nullable().describe("YYYY-MM-DD if a date can be resolved, else null."),
  startTime: z.string().nullable().describe("HH:MM 24h if a start time is implied, else null."),
  guests: z.number().int().nullable(),
  eventType: z.enum(keys(EVENT_TYPES)).nullable(),
  budgetCents: z.number().int().nullable().describe("Total or per-person budget in cents."),
  budgetPerPerson: z.boolean().nullable(),
  privacy: z.array(PrivacyEnum).describe("Acceptable privacy levels; empty if not stated."),
  cuisines: z.array(z.enum(keys(CUISINES))),
  ambiance: z.array(z.enum(keys(AMBIANCE))),
  foodStyles: z.array(z.enum(keys(FOOD_STYLES))),
  indoorOutdoor: z.array(IndoorOutdoorEnum),
  amenities: z.array(z.enum(keys(AMENITIES))),
  avRequired: z.boolean(),
  displayRequired: z.boolean().describe("True when a TV, screen or projector is needed."),
  privateBar: z.boolean(),
  parking: z.boolean(),
  accessible: z.boolean(),
  format: z.enum(["seated", "standing"]).nullable(),
  durationMinutes: z.number().int().nullable(),
  spaceTypes: z.array(z.enum(keys(SPACE_TYPES))),
  unresolved: z.array(z.string()).describe("Things the user said that could not be mapped to filters."),
});
export type InterpretedRequest = z.infer<typeof InterpretedRequestSchema>;

/** Structured read of a venue's reply to an outreach email or call. */
export const VenueResponseSummarySchema = z.object({
  summary: z.string(),
  availability: z.enum(["available", "unavailable", "tentative", "unclear"]),
  quote: z.object({
    fbMinimumCents: z.number().int().nullable(),
    roomFeeCents: z.number().int().nullable(),
    perPersonCents: z.number().int().nullable(),
    serviceChargePct: z.number().nullable(),
    adminFeePct: z.number().nullable(),
    taxPct: z.number().nullable(),
    depositCents: z.number().int().nullable(),
    minimumIncludesRoomFee: z.boolean().nullable(),
    minimumIncludesServiceAndTax: z.boolean().nullable(),
    inclusions: z.string().nullable(),
    cancellationTerms: z.string().nullable(),
  }),
  capacityConfirmed: z.number().int().nullable(),
  avConfirmed: z.boolean().nullable(),
  privacyConfirmed: PrivacyEnum.nullable(),
  unansweredQuestions: z.array(z.string()),
  suggestedFollowUps: z.array(z.string()),
  suggestedCandidateStatus: z.enum([
    "contacted",
    "available",
    "unavailable",
    "needs_clarification",
    "quote_received",
  ]),
});
export type VenueResponseSummary = z.infer<typeof VenueResponseSummarySchema>;

export const DraftEmailSchema = z.object({
  subject: z.string(),
  body: z.string(),
});
export type DraftEmail = z.infer<typeof DraftEmailSchema>;

/** Candidate inventory extracted from a web page or PDF. Nulls mean "not found". */
export const ExtractedSpaceSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  spaceType: z.enum(keys(SPACE_TYPES)).nullable(),
  privacy: PrivacyEnum.nullable(),
  indoorOutdoor: IndoorOutdoorEnum.nullable(),
  minGuests: z.number().int().nullable(),
  maxSeated: z.number().int().nullable(),
  maxStanding: z.number().int().nullable(),
  roomFeeCents: z.number().int().nullable(),
  fbMinimumCents: z.number().int().nullable(),
  estPerPersonLowCents: z.number().int().nullable(),
  estPerPersonHighCents: z.number().int().nullable(),
  depositCents: z.number().int().nullable(),
  serviceChargePct: z.number().nullable(),
  amenities: z.array(z.enum(keys(AMENITIES))),
  foodStyles: z.array(z.enum(keys(FOOD_STYLES))),
  availabilityNotes: z.string().nullable(),
  pricingNotes: z.string().nullable(),
  evidence: z.string().nullable().describe("Short quote from the source supporting the key facts."),
  confidence: z.number().min(0).max(1),
});

export const ExtractedInventorySchema = z.object({
  restaurant: z.object({
    name: z.string().nullable(),
    description: z.string().nullable(),
    cuisines: z.array(z.enum(keys(CUISINES))),
    addressLine1: z.string().nullable(),
    cityName: z.string().nullable(),
    state: z.string().nullable(),
    postalCode: z.string().nullable(),
    phone: z.string().nullable(),
    eventsContactName: z.string().nullable(),
    eventsContactEmail: z.string().nullable(),
    eventsContactPhone: z.string().nullable(),
    eventsPageUrl: z.string().nullable(),
    menuUrls: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  }),
  spaces: z.array(ExtractedSpaceSchema),
  notes: z.string().nullable(),
});
export type ExtractedInventory = z.infer<typeof ExtractedInventorySchema>;
export type ExtractedSpace = z.infer<typeof ExtractedSpaceSchema>;
