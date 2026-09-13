/**
 * The common intermediate representation every ingestion source produces.
 * Candidates are reviewed in the admin console, then applied via `apply.ts`.
 */
import type { CapacityConfiguration, DaypartMinimum, FactConfidence, IndoorOutdoor, PrivacyLevel, SourceType, SpaceType } from "@/db/schema";

export type ProvenanceInput = {
  sourceType: SourceType;
  sourceUrl?: string | null;
  confidence: FactConfidence;
  fields?: string[] | null;
  note?: string | null;
  extractedAt?: Date | null;
  verifiedAt?: Date | null;
};

export type SpacePayload = {
  name: string;
  description?: string | null;
  spaceType?: SpaceType | null;
  privacy?: PrivacyLevel | null;
  indoorOutdoor?: IndoorOutdoor | null;
  minGuests?: number | null;
  maxSeated?: number | null;
  maxStanding?: number | null;
  configurations?: CapacityConfiguration[];
  roomFeeCents?: number | null;
  fbMinimumCents?: number | null;
  estPerPersonLowCents?: number | null;
  estPerPersonHighCents?: number | null;
  daypartMinimums?: DaypartMinimum[];
  depositCents?: number | null;
  serviceChargePct?: number | null;
  adminFeePct?: number | null;
  taxPct?: number | null;
  cancellationPolicy?: string | null;
  pricingNotes?: string | null;
  amenities?: string[];
  foodStyles?: string[];
  ambiance?: string[];
  suitableFor?: string[];
  availabilityNotes?: string | null;
  maxDurationMinutes?: number | null;
  outsideCakePolicy?: string | null;
  featureNotes?: string | null;
  researchNotes?: string | null;
  photos?: { url: string; alt?: string | null }[];
  documents?: { title: string; url: string; kind?: "menu" | "private_dining_packet" | "contract" | "floor_plan" | "other" }[];
  verificationStatus?: "unverified" | "publicly_listed" | "verified";
  lastVerifiedAt?: Date | null;
  provenance?: ProvenanceInput[];
  /** Per-field extraction confidence 0–1 (AI sources). */
  fieldConfidence?: Record<string, number>;
  confidence?: number | null;
};

export type InventoryPayload = {
  restaurant: {
    name: string;
    description?: string | null;
    cuisines?: string[];
    priceTier?: number | null;
    websiteUrl?: string | null;
    eventsPageUrl?: string | null;
    phone?: string | null;
    eventsContactName?: string | null;
    eventsContactEmail?: string | null;
    eventsContactPhone?: string | null;
    contactVerifiedAt?: Date | null;
    internalNotes?: string | null;
    documents?: { title: string; url: string; kind?: "menu" | "private_dining_packet" | "contract" | "floor_plan" | "other" }[];
    provenance?: ProvenanceInput[];
  };
  location: {
    name?: string | null;
    neighborhoodSlug?: string | null;
    neighborhoodRaw?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    cityName?: string | null;
    state?: string | null;
    postalCode?: string | null;
    lat?: number | null;
    lng?: number | null;
    hasValet?: boolean | null;
    hasParkingLot?: boolean | null;
    isWheelchairAccessible?: boolean | null;
    parkingNotes?: string | null;
  };
  spaces: SpacePayload[];
  /** Human-readable summary for the review queue. */
  summary?: string;
};
