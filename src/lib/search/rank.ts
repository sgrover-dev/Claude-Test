/**
 * Relevance scoring for space search. Hard filters are applied in SQL; this
 * module scores the survivors and explains why each matched.
 */
import { haversineMiles, type LatLng } from "@/lib/geo";
import { ALCOHOL_AMENITIES, AV_AMENITIES, DISPLAY_AMENITIES, PARKING_AMENITIES } from "@/lib/taxonomy";
import { estimateSpend, type SpendEstimate } from "./estimate";
import type { SearchFilters } from "./types";

export type RankableSpace = {
  id: string;
  privacy: string | null;
  spaceType: string;
  indoorOutdoor: string | null;
  minGuests: number | null;
  maxSeated: number | null;
  maxStanding: number | null;
  fbMinimumCents: number | null;
  roomFeeCents: number | null;
  estPerPersonLowCents: number | null;
  estPerPersonHighCents: number | null;
  serviceChargePct: string | number | null;
  taxPct: string | number | null;
  depositCents?: number | null;
  amenities: string[];
  foodStyles: string[];
  ambiance: string[];
  suitableFor: string[];
  cuisines: string[];
  verificationStatus: string;
  completenessScore: number;
  photoCount: number;
  latLng: LatLng | null;
  neighborhoodSlug: string | null;
  isWheelchairAccessible?: boolean | null;
  hasValet?: boolean | null;
  hasParkingLot?: boolean | null;
  name: string;
  restaurantName: string;
  description?: string | null;
};

export type RankedSpace<T extends RankableSpace = RankableSpace> = {
  space: T;
  score: number;
  reasons: string[];
  warnings: string[];
  estimate: SpendEstimate;
  distanceMiles: number | null;
};

export type RankContext = {
  origin?: LatLng | null; // neighborhood center or user location
  defaultTaxPct?: number;
};

export function capacityFits(space: RankableSpace, guests: number, format?: "seated" | "standing"): "fits" | "tight" | "no" {
  const cap = format === "standing" ? (space.maxStanding ?? space.maxSeated) : (space.maxSeated ?? space.maxStanding);
  const min = space.minGuests ?? 0;
  if (cap == null) return "tight"; // unknown capacity: keep, but flag
  if (guests > cap) return guests <= cap * 1.1 ? "tight" : "no";
  if (guests < min) return guests >= min * 0.8 ? "tight" : "no";
  return "fits";
}

export function rankSpaces<T extends RankableSpace>(spaces: T[], f: SearchFilters, ctx: RankContext = {}): RankedSpace<T>[] {
  const ranked: RankedSpace<T>[] = [];
  for (const s of spaces) {
    const reasons: string[] = [];
    const warnings: string[] = [];
    let score = 0;

    // Capacity ----------------------------------------------------------
    if (f.guests) {
      const fit = capacityFits(s, f.guests, f.format);
      if (fit === "no") continue;
      const cap = f.format === "standing" ? s.maxStanding ?? s.maxSeated : s.maxSeated ?? s.maxStanding;
      if (fit === "fits" && cap) {
        const utilization = f.guests / cap;
        // Prefer rooms that are neither cavernous nor at the limit.
        score += utilization >= 0.5 && utilization <= 0.95 ? 30 : utilization > 0.95 ? 22 : 15;
        reasons.push(`Fits ${f.guests} guests`);
      } else {
        score += 5;
        warnings.push(cap == null ? "Capacity not yet confirmed" : "Capacity is tight — confirm with venue");
      }
    }

    // Privacy -----------------------------------------------------------
    if (f.privacy?.length) {
      if (s.privacy && f.privacy.includes(s.privacy as never)) {
        score += 20;
        reasons.push(labelPrivacy(s.privacy));
      } else if (!s.privacy) {
        warnings.push("Privacy level unknown");
      } else {
        score -= 15;
      }
    } else if (s.privacy === "fully_private") score += 4;

    // Budget ------------------------------------------------------------
    const estimate = estimateSpend(s, f.guests, ctx.defaultTaxPct);
    if (f.budgetCents) {
      const budgetTotal = f.budgetPerPerson ? f.budgetCents * (f.guests ?? 1) : f.budgetCents;
      const low = estimate.lowCents;
      if (low == null) {
        warnings.push("Pricing not yet known");
        score += 2;
      } else if (low <= budgetTotal) {
        score += 20;
        reasons.push("Within budget");
      } else if (low <= budgetTotal * 1.15) {
        score += 8;
        warnings.push("Slightly above budget");
      } else {
        score -= 20;
        warnings.push("Likely above budget");
      }
    }
    if (f.maxMinimumCents != null && s.fbMinimumCents != null) {
      if (s.fbMinimumCents <= f.maxMinimumCents) score += 8;
      else score -= 12;
    }

    // Amenities ---------------------------------------------------------
    const has = (keys: string[]) => keys.some((k) => s.amenities.includes(k));
    if (f.avRequired) {
      if (has(AV_AMENITIES)) {
        score += 12;
        reasons.push("AV available");
      } else score -= 25;
    }
    if (f.displayRequired) {
      if (has(DISPLAY_AMENITIES)) {
        score += 12;
        reasons.push("Screen or TV");
      } else score -= 25;
    }
    if (f.privateBar) {
      if (s.amenities.includes("private_bar")) {
        score += 10;
        reasons.push("Private bar");
      } else score -= 15;
    }
    if (f.alcohol) {
      if (has(ALCOHOL_AMENITIES)) score += 4;
      else warnings.push("Bar service not confirmed");
    }
    if (f.parking) {
      if (has(PARKING_AMENITIES) || s.hasValet || s.hasParkingLot) {
        score += 6;
        reasons.push("Parking or valet");
      } else warnings.push("Parking not confirmed");
    }
    if (f.accessible) {
      if (s.amenities.includes("wheelchair_accessible") || s.isWheelchairAccessible) {
        score += 6;
        reasons.push("Wheelchair accessible");
      } else warnings.push("Accessibility not confirmed");
    }
    if (f.amenities?.length) {
      const matched = f.amenities.filter((a) => s.amenities.includes(a));
      score += matched.length * 6 - (f.amenities.length - matched.length) * 8;
    }

    // Taste ---------------------------------------------------------------
    if (f.cuisines?.length) {
      const m = f.cuisines.filter((c) => s.cuisines.includes(c));
      if (m.length) {
        score += 12;
        reasons.push(m.map(titleCase).join(", "));
      } else score -= 10;
    }
    if (f.ambiance?.length) {
      const m = f.ambiance.filter((a) => s.ambiance.includes(a));
      score += m.length * 6;
      if (m.length) reasons.push(m.map(titleCase).join(" · "));
    }
    if (f.foodStyles?.length) {
      const m = f.foodStyles.filter((a) => s.foodStyles.includes(a));
      score += m.length * 5;
    }
    if (f.indoorOutdoor?.length) {
      if (s.indoorOutdoor && f.indoorOutdoor.includes(s.indoorOutdoor as never)) score += 10;
      else score -= 10;
    }
    if (f.spaceTypes?.length) {
      if (f.spaceTypes.includes(s.spaceType)) score += 10;
      else score -= 10;
    }
    if (f.eventType) {
      if (s.suitableFor.includes(f.eventType)) {
        score += 10;
        reasons.push(`Good for ${titleCase(f.eventType)}`);
      }
      if (f.format === "standing" && s.maxStanding) score += 3;
    }
    if (f.format === "standing" && s.maxStanding == null) warnings.push("Standing capacity unknown");

    // Location ----------------------------------------------------------
    let distanceMiles: number | null = null;
    if (ctx.origin && s.latLng) {
      distanceMiles = haversineMiles(ctx.origin, s.latLng);
      if (f.neighborhood && s.neighborhoodSlug === f.neighborhood) {
        score += 15;
        reasons.push(`In ${titleCase(f.neighborhood)}`);
      } else if (distanceMiles <= 2) score += 10;
      else if (distanceMiles <= 5) score += 4;
      else if (distanceMiles > 10) score -= 8;
    } else if (f.neighborhood && s.neighborhoodSlug === f.neighborhood) {
      score += 15;
      reasons.push(`In ${titleCase(f.neighborhood)}`);
    }

    // Text --------------------------------------------------------------
    if (f.q) {
      const q = f.q.toLowerCase();
      const hay = `${s.name} ${s.restaurantName} ${s.description ?? ""} ${s.cuisines.join(" ")}`.toLowerCase();
      if (hay.includes(q)) score += 15;
      else {
        const terms = q.split(/\s+/).filter((t) => t.length > 2);
        const hits = terms.filter((t) => hay.includes(t)).length;
        score += hits * 4;
      }
    }

    // Data quality ------------------------------------------------------
    if (s.verificationStatus === "verified") {
      score += 8;
      reasons.push("Verified by Red Rope");
    } else if (s.verificationStatus === "publicly_listed") score += 3;
    score += Math.round(s.completenessScore / 20); // 0–5
    if (s.photoCount > 0) score += 3;

    ranked.push({ space: s, score, reasons: dedupe(reasons).slice(0, 4), warnings: dedupe(warnings), estimate, distanceMiles });
  }

  const sort = f.sort ?? "relevance";
  ranked.sort((a, b) => {
    if (sort === "price_asc") return (a.estimate.lowCents ?? Infinity) - (b.estimate.lowCents ?? Infinity);
    if (sort === "price_desc") return (b.estimate.lowCents ?? -1) - (a.estimate.lowCents ?? -1);
    if (sort === "capacity") return (b.space.maxSeated ?? b.space.maxStanding ?? 0) - (a.space.maxSeated ?? a.space.maxStanding ?? 0);
    return b.score - a.score || a.space.name.localeCompare(b.space.name);
  });
  return ranked;
}

function labelPrivacy(p: string) {
  return { fully_private: "Fully private", semi_private: "Semi-private", shared: "Shared section", buyout: "Buyout" }[p] ?? p;
}
function titleCase(s: string) {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function dedupe(a: string[]) {
  return Array.from(new Set(a));
}
