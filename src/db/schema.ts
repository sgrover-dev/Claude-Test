/**
 * Red Rope data model.
 *
 * The atomic marketplace unit is Restaurant → Location → Space.
 * Every meaningful fact can carry provenance (see `factSources`).
 * Cities are first-class so new markets are configuration, not code.
 */
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* ----------------------------------------------------------------------------
 * Enums
 * -------------------------------------------------------------------------- */

export const privacyLevelEnum = pgEnum("privacy_level", [
  "fully_private",
  "semi_private",
  "shared",
  "buyout",
]);

export const spaceTypeEnum = pgEnum("space_type", [
  "private_dining_room",
  "semi_private_room",
  "patio",
  "rooftop",
  "wine_room",
  "chefs_table",
  "bar_lounge",
  "dining_section",
  "upstairs_room",
  "event_room",
  "full_buyout",
  "other",
]);

export const indoorOutdoorEnum = pgEnum("indoor_outdoor", [
  "indoor",
  "outdoor",
  "covered_outdoor",
  "mixed",
]);

export const availabilityModeEnum = pgEnum("availability_mode", [
  "request", // unknown / request availability
  "rules", // known availability rules
  "instant", // instant book (future)
]);

export const entityStatusEnum = pgEnum("entity_status", [
  "draft",
  "active",
  "archived",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "unverified",
  "publicly_listed",
  "verified",
]);

/** Confidence classification for any stored fact. */
export const confidenceEnum = pgEnum("fact_confidence", [
  "verified", // confirmed directly with the venue
  "publicly_listed", // taken from the venue's own public materials
  "estimate", // Red Rope estimate / inference
  "unknown",
]);

export const sourceTypeEnum = pgEnum("source_type", [
  "restaurant_website",
  "private_dining_pdf",
  "phone_confirmation",
  "email_confirmation",
  "restaurant_claimed",
  "public_listing",
  "red_rope_research",
  "csv_import",
  "ai_extraction",
  "manual_entry",
]);

export const userRoleEnum = pgEnum("user_role", ["consumer", "ops", "admin"]);

export const inquiryStatusEnum = pgEnum("inquiry_status", [
  "draft",
  "submitted",
  "researching",
  "contacting_venues",
  "awaiting_venue",
  "options_available",
  "customer_reviewing",
  "customer_selected",
  "deposit_required",
  "booking_pending",
  "booked",
  "closed",
  "cancelled",
]);

export const candidateStatusEnum = pgEnum("candidate_status", [
  "not_contacted",
  "contacted",
  "follow_up_due",
  "available",
  "unavailable",
  "needs_clarification",
  "quote_received",
  "customer_rejected",
  "customer_selected",
]);

export const timelineKindEnum = pgEnum("timeline_kind", [
  "email_out",
  "email_in",
  "phone_call",
  "note",
  "quote",
  "contract",
  "menu",
  "deposit_request",
  "customer_message",
  "customer_update",
  "status_change",
  "ai_summary",
  "system",
]);

export const actorTypeEnum = pgEnum("actor_type", [
  "ops",
  "customer",
  "venue",
  "ai",
  "system",
]);

export const aiDraftKindEnum = pgEnum("ai_draft_kind", [
  "venue_outreach",
  "venue_follow_up",
  "customer_update",
  "response_summary",
  "quote_extraction",
  "quote_comparison",
]);

export const aiDraftStatusEnum = pgEnum("ai_draft_status", [
  "draft",
  "approved",
  "rejected",
  "sent",
]);

export const ingestionSourceEnum = pgEnum("ingestion_source", [
  "manual",
  "csv",
  "url",
  "ai_web",
  "pdf",
  "provider",
  "claim",
]);

export const ingestionStatusEnum = pgEnum("ingestion_status", [
  "queued",
  "running",
  "needs_review",
  "completed",
  "rejected",
  "failed",
]);

export const extractionCandidateStatusEnum = pgEnum(
  "extraction_candidate_status",
  ["pending", "approved", "rejected", "merged"],
);

export const documentKindEnum = pgEnum("document_kind", [
  "menu",
  "private_dining_packet",
  "contract",
  "floor_plan",
  "other",
]);

export const paymentKindEnum = pgEnum("payment_kind", [
  "red_rope_deposit",
  "concierge_fee",
  "booking_fee",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
  "cancelled",
]);

export const claimStatusEnum = pgEnum("claim_status", [
  "pending",
  "verified",
  "rejected",
]);

/* ----------------------------------------------------------------------------
 * Geography
 * -------------------------------------------------------------------------- */

export const cities = pgTable(
  "cities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    state: text("state").notNull(),
    country: text("country").notNull().default("US"),
    timezone: text("timezone").notNull().default("America/Chicago"),
    lat: numeric("lat", { precision: 9, scale: 6 }),
    lng: numeric("lng", { precision: 9, scale: 6 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("cities_slug_idx").on(t.slug)],
);

export const neighborhoods = pgTable(
  "neighborhoods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
    lat: numeric("lat", { precision: 9, scale: 6 }),
    lng: numeric("lng", { precision: 9, scale: 6 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("neighborhoods_city_slug_idx").on(t.cityId, t.slug)],
);

/* ----------------------------------------------------------------------------
 * Inventory: Restaurant → Location → Space
 * -------------------------------------------------------------------------- */

export const restaurants = pgTable(
  "restaurants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    cuisines: text("cuisines").array().notNull().default(sql`'{}'::text[]`),
    priceTier: integer("price_tier"), // 1–4
    websiteUrl: text("website_url"),
    eventsPageUrl: text("events_page_url"),
    phone: text("phone"),
    email: text("email"),
    eventsContactName: text("events_contact_name"),
    eventsContactEmail: text("events_contact_email"),
    eventsContactPhone: text("events_contact_phone"),
    contactVerifiedAt: timestamp("contact_verified_at", { withTimezone: true }),
    heroImageUrl: text("hero_image_url"),
    internalNotes: text("internal_notes"),
    status: entityStatusEnum("status").notNull().default("active"),
    claimedByUserId: uuid("claimed_by_user_id"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("restaurants_slug_idx").on(t.slug)],
);

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id),
    neighborhoodId: uuid("neighborhood_id").references(() => neighborhoods.id, {
      onDelete: "set null",
    }),
    slug: text("slug").notNull(),
    name: text("name"), // e.g. "Galleria" for multi-location brands
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    cityName: text("city_name"),
    state: text("state"),
    postalCode: text("postal_code"),
    lat: numeric("lat", { precision: 9, scale: 6 }),
    lng: numeric("lng", { precision: 9, scale: 6 }),
    phone: text("phone"),
    parkingNotes: text("parking_notes"),
    hasValet: boolean("has_valet"),
    hasParkingLot: boolean("has_parking_lot"),
    isWheelchairAccessible: boolean("is_wheelchair_accessible"),
    status: entityStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("locations_restaurant_slug_idx").on(t.restaurantId, t.slug),
    index("locations_city_idx").on(t.cityId),
    index("locations_neighborhood_idx").on(t.neighborhoodId),
  ],
);

/** Capacity per configuration, e.g. { name: "U-shape", seated: 18, standing: null } */
export type CapacityConfiguration = {
  name: string;
  seated: number | null;
  standing: number | null;
};

/** Minimum spend by daypart, e.g. { label: "Fri/Sat dinner", amountCents: 500000 } */
export type DaypartMinimum = {
  label: string;
  amountCents: number;
  note?: string;
};

export const spaces = pgTable(
  "spaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    spaceType: spaceTypeEnum("space_type").notNull().default("other"),
    privacy: privacyLevelEnum("privacy"),
    indoorOutdoor: indoorOutdoorEnum("indoor_outdoor"),

    // Capacity
    minGuests: integer("min_guests"),
    maxSeated: integer("max_seated"),
    maxStanding: integer("max_standing"),
    configurations: jsonb("configurations")
      .$type<CapacityConfiguration[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    // Pricing (all money in integer cents)
    roomFeeCents: integer("room_fee_cents"),
    fbMinimumCents: integer("fb_minimum_cents"),
    estPerPersonLowCents: integer("est_per_person_low_cents"),
    estPerPersonHighCents: integer("est_per_person_high_cents"),
    daypartMinimums: jsonb("daypart_minimums")
      .$type<DaypartMinimum[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    depositCents: integer("deposit_cents"),
    depositNotes: text("deposit_notes"),
    serviceChargePct: numeric("service_charge_pct", { precision: 5, scale: 2 }),
    adminFeePct: numeric("admin_fee_pct", { precision: 5, scale: 2 }),
    taxPct: numeric("tax_pct", { precision: 5, scale: 2 }),
    cancellationPolicy: text("cancellation_policy"),
    pricingNotes: text("pricing_notes"),

    // Amenities and food
    amenities: text("amenities").array().notNull().default(sql`'{}'::text[]`),
    foodStyles: text("food_styles").array().notNull().default(sql`'{}'::text[]`),
    ambiance: text("ambiance").array().notNull().default(sql`'{}'::text[]`),
    suitableFor: text("suitable_for").array().notNull().default(sql`'{}'::text[]`),
    dietaryAccommodations: text("dietary_accommodations"),
    menuNotes: text("menu_notes"),

    // Operational
    availabilityMode: availabilityModeEnum("availability_mode")
      .notNull()
      .default("request"),
    availabilityNotes: text("availability_notes"),
    maxDurationMinutes: integer("max_duration_minutes"),
    ageRestriction: text("age_restriction"),
    decorPolicy: text("decor_policy"),
    outsideCakePolicy: text("outside_cake_policy"),
    outsideVendorPolicy: text("outside_vendor_policy"),
    otherRestrictions: text("other_restrictions"),
    /** Raw feature text from the source (e.g. "Crystal chandeliers | Balcony"). */
    featureNotes: text("feature_notes"),
    /** Internal research notes; never shown to consumers. */
    researchNotes: text("research_notes"),

    // Lifecycle & quality
    status: entityStatusEnum("status").notNull().default("active"),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("unverified"),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    completenessScore: integer("completeness_score").notNull().default(0),
    mergedIntoSpaceId: uuid("merged_into_space_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("spaces_slug_idx").on(t.slug),
    index("spaces_location_idx").on(t.locationId),
    index("spaces_status_idx").on(t.status),
    index("spaces_capacity_idx").on(t.minGuests, t.maxSeated, t.maxStanding),
  ],
);

export const spacePhotos = pgTable(
  "space_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt"),
    sortOrder: integer("sort_order").notNull().default(0),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("space_photos_space_idx").on(t.spaceId)],
);

export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday
    startTime: time("start_time"),
    endTime: time("end_time"),
    label: text("label"), // e.g. "Dinner", "Lunch"
    note: text("note"),
  },
  (t) => [index("availability_rules_space_idx").on(t.spaceId)],
);

/** Menus, PDFs, contracts, floor plans attached to a restaurant, location or space. */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(), // restaurant | location | space | inquiry
    entityId: uuid("entity_id").notNull(),
    kind: documentKindEnum("kind").notNull().default("other"),
    title: text("title").notNull(),
    url: text("url"),
    storageKey: text("storage_key"),
    mimeType: text("mime_type"),
    extractedText: text("extracted_text"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("documents_entity_idx").on(t.entityType, t.entityId)],
);

/**
 * Provenance: where a fact came from. `field` is null for record-level sources.
 * Multiple rows may exist per field; the latest verified row wins for display.
 */
export const factSources = pgTable(
  "fact_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(), // restaurant | location | space
    entityId: uuid("entity_id").notNull(),
    field: text("field"),
    sourceType: sourceTypeEnum("source_type").notNull(),
    sourceUrl: text("source_url"),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    confidence: confidenceEnum("confidence").notNull().default("unknown"),
    verificationMethod: text("verification_method"),
    extractedAt: timestamp("extracted_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    note: text("note"),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("fact_sources_entity_idx").on(t.entityType, t.entityId)],
);

/* ----------------------------------------------------------------------------
 * Accounts
 * -------------------------------------------------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name"),
    phone: text("phone"),
    role: userRoleEnum("role").notNull().default("consumer"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const magicLinks = pgTable(
  "magic_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    redirectTo: text("redirect_to"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("magic_links_token_idx").on(t.tokenHash)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_idx").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
  ],
);

export const savedSpaces = pgTable(
  "saved_spaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("saved_spaces_user_space_idx").on(t.userId, t.spaceId)],
);

export const savedSearches = pgTable(
  "saved_searches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    query: jsonb("query").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("saved_searches_user_idx").on(t.userId)],
);

/* ----------------------------------------------------------------------------
 * Inquiries (booking requests) and operations
 * -------------------------------------------------------------------------- */

export const inquiries = pgTable(
  "inquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: serial("number").notNull(), // human-friendly: Inquiry #1847
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    cityId: uuid("city_id").references(() => cities.id),
    status: inquiryStatusEnum("status").notNull().default("submitted"),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone"),
    company: text("company"),

    eventType: text("event_type"),
    eventDate: date("event_date"),
    startTime: time("start_time"),
    timeFlexibility: text("time_flexibility"), // e.g. "6–8 PM works"
    durationMinutes: integer("duration_minutes"),
    guestCount: integer("guest_count").notNull(),
    budgetCents: integer("budget_cents"),
    budgetIsPerPerson: boolean("budget_is_per_person").notNull().default(false),
    foodPreferences: text("food_preferences"),
    dietaryNeeds: text("dietary_needs"),
    avRequirements: text("av_requirements"),
    privacyRequirement: privacyLevelEnum("privacy_requirement"),
    specialRequests: text("special_requests"),

    searchSnapshot: jsonb("search_snapshot").$type<Record<string, unknown>>(),
    attribution: jsonb("attribution").$type<Record<string, unknown>>(),
    internalNotes: text("internal_notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("inquiries_number_idx").on(t.number),
    index("inquiries_status_idx").on(t.status),
    index("inquiries_user_idx").on(t.userId),
  ],
);

/** A candidate venue (space) attached to an inquiry, with its own status. */
export const inquiryCandidates = pgTable(
  "inquiry_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id),
    rank: integer("rank").notNull().default(0), // 0 = preferred
    isPreferred: boolean("is_preferred").notNull().default(false),
    status: candidateStatusEnum("status").notNull().default("not_contacted"),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    declineReason: text("decline_reason"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("inquiry_candidates_unique_idx").on(t.inquiryId, t.spaceId),
    index("inquiry_candidates_space_idx").on(t.spaceId),
  ],
);

/** Structured communication timeline for an inquiry. */
export const inquiryEvents = pgTable(
  "inquiry_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id").references(() => inquiryCandidates.id, {
      onDelete: "set null",
    }),
    kind: timelineKindEnum("kind").notNull(),
    actorType: actorTypeEnum("actor_type").notNull().default("ops"),
    actorUserId: uuid("actor_user_id"),
    subject: text("subject"),
    body: text("body"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("inquiry_events_inquiry_idx").on(t.inquiryId, t.occurredAt)],
);

/** Normalized quote line items are stored in `normalized` (see lib/quotes). */
export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => inquiryCandidates.id, { onDelete: "cascade" }),
    rawText: text("raw_text"),
    guestCount: integer("guest_count"),
    fbMinimumCents: integer("fb_minimum_cents"),
    roomFeeCents: integer("room_fee_cents"),
    perPersonCents: integer("per_person_cents"),
    serviceChargePct: numeric("service_charge_pct", { precision: 5, scale: 2 }),
    adminFeePct: numeric("admin_fee_pct", { precision: 5, scale: 2 }),
    taxPct: numeric("tax_pct", { precision: 5, scale: 2 }),
    depositCents: integer("deposit_cents"),
    minimumIncludesRoomFee: boolean("minimum_includes_room_fee"),
    minimumIncludesServiceAndTax: boolean("minimum_includes_service_and_tax"),
    inclusions: text("inclusions"),
    cancellationTerms: text("cancellation_terms"),
    normalized: jsonb("normalized").$type<Record<string, unknown>>(),
    assumptions: text("assumptions").array().notNull().default(sql`'{}'::text[]`),
    isCurrent: boolean("is_current").notNull().default(true),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("quotes_inquiry_idx").on(t.inquiryId)],
);

/** AI-generated drafts always require human approval before leaving Red Rope. */
export const aiDrafts = pgTable(
  "ai_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id").references(() => inquiryCandidates.id, {
      onDelete: "set null",
    }),
    kind: aiDraftKindEnum("kind").notNull(),
    subject: text("subject"),
    content: text("content").notNull(),
    structured: jsonb("structured").$type<Record<string, unknown>>(),
    status: aiDraftStatusEnum("status").notNull().default("draft"),
    model: text("model"),
    approvedByUserId: uuid("approved_by_user_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ai_drafts_inquiry_idx").on(t.inquiryId)],
);

/* ----------------------------------------------------------------------------
 * Ingestion pipeline
 * -------------------------------------------------------------------------- */

export const ingestionJobs = pgTable(
  "ingestion_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: ingestionSourceEnum("source").notNull(),
    status: ingestionStatusEnum("status").notNull().default("queued"),
    inputUrl: text("input_url"),
    inputLabel: text("input_label"),
    targetRestaurantId: uuid("target_restaurant_id").references(
      () => restaurants.id,
      { onDelete: "set null" },
    ),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
    summary: text("summary"),
    error: text("error"),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("ingestion_jobs_status_idx").on(t.status)],
);

/** Structured candidate awaiting admin review before it becomes inventory. */
export const extractionCandidates = pgTable(
  "extraction_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => ingestionJobs.id, { onDelete: "cascade" }),
    candidateType: text("candidate_type").notNull(), // restaurant | location | space
    parentCandidateId: uuid("parent_candidate_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    fieldConfidence: jsonb("field_confidence").$type<Record<string, number>>(),
    overallConfidence: numeric("overall_confidence", { precision: 4, scale: 3 }),
    sourceUrl: text("source_url"),
    status: extractionCandidateStatusEnum("status").notNull().default("pending"),
    appliedEntityId: uuid("applied_entity_id"),
    reviewerNotes: text("reviewer_notes"),
    reviewedByUserId: uuid("reviewed_by_user_id"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("extraction_candidates_job_idx").on(t.jobId, t.status)],
);

/* ----------------------------------------------------------------------------
 * Restaurant ownership (future), payments, analytics, reviews (future)
 * -------------------------------------------------------------------------- */

export const restaurantClaims = pgTable("restaurant_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: claimStatusEnum("status").notNull().default("pending"),
  verificationMethod: text("verification_method"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inquiryId: uuid("inquiry_id").references(() => inquiries.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    kind: paymentKindEnum("kind").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    provider: text("provider").notNull().default("stripe"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("payments_inquiry_idx").on(t.inquiryId)],
);

/** Lightweight demand analytics used for future "claim your listing" outreach. */
export const spaceViews = pgTable(
  "space_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    visitorId: text("visitor_id"),
    referrer: text("referrer"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("space_views_space_idx").on(t.spaceId, t.createdAt)],
);

/** Event-space reviews (not restaurant food reviews). Schema only for V1. */
export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  inquiryId: uuid("inquiry_id").references(() => inquiries.id, {
    onDelete: "set null",
  }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  overallRating: integer("overall_rating"),
  privacyAccurate: boolean("privacy_accurate"),
  capacityAccurate: boolean("capacity_accurate"),
  avWorked: boolean("av_worked"),
  staffRating: integer("staff_rating"),
  bookingProcessRating: integer("booking_process_rating"),
  valueRating: integer("value_rating"),
  suitabilityRating: integer("suitability_rating"),
  body: text("body"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ----------------------------------------------------------------------------
 * Relations
 * -------------------------------------------------------------------------- */

export const citiesRelations = relations(cities, ({ many }) => ({
  neighborhoods: many(neighborhoods),
  locations: many(locations),
}));

export const neighborhoodsRelations = relations(neighborhoods, ({ one, many }) => ({
  city: one(cities, { fields: [neighborhoods.cityId], references: [cities.id] }),
  locations: many(locations),
}));

export const restaurantsRelations = relations(restaurants, ({ many }) => ({
  locations: many(locations),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [locations.restaurantId],
    references: [restaurants.id],
  }),
  city: one(cities, { fields: [locations.cityId], references: [cities.id] }),
  neighborhood: one(neighborhoods, {
    fields: [locations.neighborhoodId],
    references: [neighborhoods.id],
  }),
  spaces: many(spaces),
}));

export const spacesRelations = relations(spaces, ({ one, many }) => ({
  location: one(locations, {
    fields: [spaces.locationId],
    references: [locations.id],
  }),
  photos: many(spacePhotos),
  availabilityRules: many(availabilityRules),
}));

export const spacePhotosRelations = relations(spacePhotos, ({ one }) => ({
  space: one(spaces, { fields: [spacePhotos.spaceId], references: [spaces.id] }),
}));

export const availabilityRulesRelations = relations(availabilityRules, ({ one }) => ({
  space: one(spaces, {
    fields: [availabilityRules.spaceId],
    references: [spaces.id],
  }),
}));

export const inquiriesRelations = relations(inquiries, ({ one, many }) => ({
  user: one(users, { fields: [inquiries.userId], references: [users.id] }),
  candidates: many(inquiryCandidates),
  events: many(inquiryEvents),
  quotes: many(quotes),
  aiDrafts: many(aiDrafts),
  payments: many(payments),
}));

export const inquiryCandidatesRelations = relations(inquiryCandidates, ({ one, many }) => ({
  inquiry: one(inquiries, {
    fields: [inquiryCandidates.inquiryId],
    references: [inquiries.id],
  }),
  space: one(spaces, {
    fields: [inquiryCandidates.spaceId],
    references: [spaces.id],
  }),
  quotes: many(quotes),
  events: many(inquiryEvents),
}));

export const inquiryEventsRelations = relations(inquiryEvents, ({ one }) => ({
  inquiry: one(inquiries, {
    fields: [inquiryEvents.inquiryId],
    references: [inquiries.id],
  }),
  candidate: one(inquiryCandidates, {
    fields: [inquiryEvents.candidateId],
    references: [inquiryCandidates.id],
  }),
}));

export const quotesRelations = relations(quotes, ({ one }) => ({
  inquiry: one(inquiries, { fields: [quotes.inquiryId], references: [inquiries.id] }),
  candidate: one(inquiryCandidates, {
    fields: [quotes.candidateId],
    references: [inquiryCandidates.id],
  }),
}));

export const aiDraftsRelations = relations(aiDrafts, ({ one }) => ({
  inquiry: one(inquiries, { fields: [aiDrafts.inquiryId], references: [inquiries.id] }),
  candidate: one(inquiryCandidates, {
    fields: [aiDrafts.candidateId],
    references: [inquiryCandidates.id],
  }),
}));

export const ingestionJobsRelations = relations(ingestionJobs, ({ many }) => ({
  candidates: many(extractionCandidates),
}));

export const extractionCandidatesRelations = relations(extractionCandidates, ({ one }) => ({
  job: one(ingestionJobs, {
    fields: [extractionCandidates.jobId],
    references: [ingestionJobs.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  savedSpaces: many(savedSpaces),
  savedSearches: many(savedSearches),
  inquiries: many(inquiries),
}));

export const savedSpacesRelations = relations(savedSpaces, ({ one }) => ({
  user: one(users, { fields: [savedSpaces.userId], references: [users.id] }),
  space: one(spaces, { fields: [savedSpaces.spaceId], references: [spaces.id] }),
}));

/* ----------------------------------------------------------------------------
 * Inferred types
 * -------------------------------------------------------------------------- */

export type City = typeof cities.$inferSelect;
export type Neighborhood = typeof neighborhoods.$inferSelect;
export type Restaurant = typeof restaurants.$inferSelect;
export type NewRestaurant = typeof restaurants.$inferInsert;
export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
export type Space = typeof spaces.$inferSelect;
export type NewSpace = typeof spaces.$inferInsert;
export type SpacePhoto = typeof spacePhotos.$inferSelect;
export type AvailabilityRule = typeof availabilityRules.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type FactSource = typeof factSources.$inferSelect;
export type NewFactSource = typeof factSources.$inferInsert;
export type User = typeof users.$inferSelect;
export type Inquiry = typeof inquiries.$inferSelect;
export type NewInquiry = typeof inquiries.$inferInsert;
export type InquiryCandidate = typeof inquiryCandidates.$inferSelect;
export type InquiryEvent = typeof inquiryEvents.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type AiDraft = typeof aiDrafts.$inferSelect;
export type IngestionJob = typeof ingestionJobs.$inferSelect;
export type ExtractionCandidate = typeof extractionCandidates.$inferSelect;
export type Payment = typeof payments.$inferSelect;

export type PrivacyLevel = (typeof privacyLevelEnum.enumValues)[number];
export type SpaceType = (typeof spaceTypeEnum.enumValues)[number];
export type IndoorOutdoor = (typeof indoorOutdoorEnum.enumValues)[number];
export type AvailabilityMode = (typeof availabilityModeEnum.enumValues)[number];
export type FactConfidence = (typeof confidenceEnum.enumValues)[number];
export type SourceType = (typeof sourceTypeEnum.enumValues)[number];
export type InquiryStatus = (typeof inquiryStatusEnum.enumValues)[number];
export type CandidateStatus = (typeof candidateStatusEnum.enumValues)[number];
export type TimelineKind = (typeof timelineKindEnum.enumValues)[number];
export type AiDraftKind = (typeof aiDraftKindEnum.enumValues)[number];
export type IngestionSource = (typeof ingestionSourceEnum.enumValues)[number];

export const paymentsRelations = relations(payments, ({ one }) => ({
  inquiry: one(inquiries, { fields: [payments.inquiryId], references: [inquiries.id] }),
  user: one(users, { fields: [payments.userId], references: [users.id] }),
}));
