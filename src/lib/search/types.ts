import type { IndoorOutdoor, PrivacyLevel } from "@/db/schema";

export type SearchSort = "relevance" | "price_asc" | "price_desc" | "capacity";

export type SearchFilters = {
  city: string; // city slug
  neighborhood?: string; // neighborhood slug
  q?: string;
  date?: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  guests?: number;
  eventType?: string;
  budgetCents?: number;
  budgetPerPerson?: boolean;
  privacy?: PrivacyLevel[];
  cuisines?: string[];
  ambiance?: string[];
  foodStyles?: string[];
  indoorOutdoor?: IndoorOutdoor[];
  amenities?: string[];
  avRequired?: boolean;
  displayRequired?: boolean; // TV / projector / screen
  accessible?: boolean;
  parking?: boolean;
  alcohol?: boolean;
  privateBar?: boolean;
  format?: "seated" | "standing";
  durationMinutes?: number;
  maxMinimumCents?: number; // minimum-spend preference
  spaceTypes?: string[];
  sort?: SearchSort;
  page?: number;
};

export const DEFAULT_CITY = "houston";
