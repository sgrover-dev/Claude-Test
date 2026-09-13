/**
 * Data-quality scoring for spaces. Used by the admin dashboard, the search
 * ranker (completeness bonus) and the "missing data" filters.
 */
import type { Space } from "@/db/schema";

export const STALE_AFTER_DAYS = 90;

type Check = { key: string; label: string; weight: number; test: (s: SpaceLike) => boolean };

export type SpaceLike = Pick<
  Space,
  | "description"
  | "privacy"
  | "minGuests"
  | "maxSeated"
  | "maxStanding"
  | "fbMinimumCents"
  | "roomFeeCents"
  | "estPerPersonLowCents"
  | "depositCents"
  | "serviceChargePct"
  | "cancellationPolicy"
  | "amenities"
  | "foodStyles"
  | "availabilityMode"
  | "availabilityNotes"
  | "lastVerifiedAt"
> & { photoCount?: number; documentCount?: number; hasContact?: boolean };

export const QUALITY_CHECKS: Check[] = [
  { key: "capacity", label: "Capacity", weight: 20, test: (s) => s.maxSeated != null || s.maxStanding != null },
  { key: "privacy", label: "Privacy level", weight: 10, test: (s) => s.privacy != null },
  {
    key: "pricing",
    label: "Pricing",
    weight: 20,
    test: (s) => s.fbMinimumCents != null || s.estPerPersonLowCents != null || s.roomFeeCents != null,
  },
  { key: "description", label: "Description", weight: 8, test: (s) => !!s.description && s.description.length > 40 },
  { key: "amenities", label: "Amenities", weight: 8, test: (s) => s.amenities.length > 0 },
  { key: "food", label: "Food style", weight: 5, test: (s) => s.foodStyles.length > 0 },
  { key: "photos", label: "Photos", weight: 12, test: (s) => (s.photoCount ?? 0) > 0 },
  { key: "deposit", label: "Deposit / fees", weight: 5, test: (s) => s.depositCents != null || s.serviceChargePct != null },
  { key: "cancellation", label: "Cancellation policy", weight: 4, test: (s) => !!s.cancellationPolicy },
  {
    key: "availability",
    label: "Availability",
    weight: 4,
    test: (s) => s.availabilityMode !== "request" || !!s.availabilityNotes,
  },
  { key: "contact", label: "Events contact", weight: 4, test: (s) => !!s.hasContact },
];

export function completenessScore(space: SpaceLike): number {
  const total = QUALITY_CHECKS.reduce((n, c) => n + c.weight, 0);
  const got = QUALITY_CHECKS.filter((c) => c.test(space)).reduce((n, c) => n + c.weight, 0);
  return Math.round((got / total) * 100);
}

export function missingFields(space: SpaceLike): Check[] {
  return QUALITY_CHECKS.filter((c) => !c.test(space));
}

export function isStale(lastVerifiedAt: Date | string | null | undefined, now = new Date()): boolean {
  if (!lastVerifiedAt) return true;
  const d = typeof lastVerifiedAt === "string" ? new Date(lastVerifiedAt) : lastVerifiedAt;
  return (now.getTime() - d.getTime()) / 864e5 > STALE_AFTER_DAYS;
}

/** Simple duplicate heuristic: same location and normalized name, or near-identical names. */
export function normalizeNameForDedupe(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(the|room|private|dining|pdr)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}
