/**
 * Seed data contract. Values here are Red Rope research: approximate, and
 * every record is stored with explicit provenance + confidence so the product
 * never presents them as verified facts.
 */
import type { CapacityConfiguration, DaypartMinimum, FactConfidence, IndoorOutdoor, PrivacyLevel, SourceType, SpaceType } from "../schema";

export type SeedNeighborhood = {
  slug: string;
  name: string;
  aliases?: string[];
  lat: number;
  lng: number;
  description?: string;
};

export type SeedProvenance = {
  sourceType: SourceType;
  sourceUrl?: string;
  confidence: FactConfidence;
  note?: string;
  /** Restrict this provenance row to specific fields (default: whole record). */
  fields?: string[];
};

export type SeedSpace = {
  name: string;
  description: string;
  spaceType: SpaceType;
  privacy: PrivacyLevel | null;
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
  depositNotes?: string | null;
  serviceChargePct?: number | null;
  taxPct?: number | null;
  cancellationPolicy?: string | null;
  pricingNotes?: string | null;
  amenities?: string[];
  foodStyles?: string[];
  ambiance?: string[];
  suitableFor?: string[];
  dietaryAccommodations?: string | null;
  menuNotes?: string | null;
  availabilityMode?: "request" | "rules" | "instant";
  availabilityNotes?: string | null;
  /** dayOfWeek 0=Sunday; times as "HH:MM". */
  availabilityRules?: { dayOfWeek: number; startTime?: string; endTime?: string; label?: string }[];
  maxDurationMinutes?: number | null;
  ageRestriction?: string | null;
  decorPolicy?: string | null;
  outsideCakePolicy?: string | null;
  outsideVendorPolicy?: string | null;
  /** Photo URLs (Unsplash or similar) with alt text. */
  photos?: { url: string; alt: string }[];
  verificationStatus?: "unverified" | "publicly_listed" | "verified";
  lastVerifiedDaysAgo?: number | null;
  provenance: SeedProvenance[];
};

export type SeedLocation = {
  name?: string | null;
  neighborhoodSlug: string;
  addressLine1: string;
  cityName: string;
  state: string;
  postalCode: string;
  lat: number;
  lng: number;
  phone?: string | null;
  parkingNotes?: string | null;
  hasValet?: boolean | null;
  hasParkingLot?: boolean | null;
  isWheelchairAccessible?: boolean | null;
  spaces: SeedSpace[];
};

export type SeedRestaurant = {
  name: string;
  description: string;
  cuisines: string[];
  priceTier: 1 | 2 | 3 | 4;
  websiteUrl?: string | null;
  eventsPageUrl?: string | null;
  phone?: string | null;
  eventsContactName?: string | null;
  eventsContactEmail?: string | null;
  eventsContactPhone?: string | null;
  heroImageUrl?: string | null;
  provenance: SeedProvenance[];
  locations: SeedLocation[];
};

export type SeedCity = {
  slug: string;
  name: string;
  state: string;
  timezone: string;
  lat: number;
  lng: number;
  defaultTaxPct: number;
  neighborhoods: SeedNeighborhood[];
  restaurants: SeedRestaurant[];
};
