import type { InterpretedRequest } from "@/lib/ai/schemas";
import type { SearchFilters } from "@/lib/search/types";
/* Same mapping as lib/ai/concierge.ts, without the server-only import. */
export function toFilters(i: InterpretedRequest): Partial<SearchFilters> {
  return {
    neighborhood: i.neighborhood ?? undefined, date: i.date ?? undefined, startTime: i.startTime ?? undefined, guests: i.guests ?? undefined,
    eventType: i.eventType ?? undefined, budgetCents: i.budgetCents ?? undefined, budgetPerPerson: i.budgetPerPerson ?? undefined,
    privacy: i.privacy.length ? i.privacy : undefined, cuisines: i.cuisines.length ? i.cuisines : undefined, ambiance: i.ambiance.length ? i.ambiance : undefined,
    foodStyles: i.foodStyles.length ? i.foodStyles : undefined, indoorOutdoor: i.indoorOutdoor.length ? i.indoorOutdoor : undefined,
    amenities: i.amenities.length ? i.amenities : undefined, avRequired: i.avRequired || undefined, displayRequired: i.displayRequired || undefined,
    privateBar: i.privateBar || undefined, parking: i.parking || undefined, accessible: i.accessible || undefined, format: i.format ?? undefined,
    durationMinutes: i.durationMinutes ?? undefined, spaceTypes: i.spaceTypes.length ? i.spaceTypes : undefined,
  };
}
