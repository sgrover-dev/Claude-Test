/* Browser bundle of the app's pure logic for the mobile prototype (built with esbuild → rr.js). */
export { rankSpaces } from "@/lib/search/rank";
export { estimateSpend } from "@/lib/search/estimate";
export { normalizeQuote } from "@/lib/quotes/normalize";
export { interpretRequestFallback } from "@/lib/ai/fallback";
export { toFilters } from "./to-filters";
export { formatCents, formatCapacity, formatDate, formatTime } from "@/lib/format";
export { haversineMiles, estimateDriveMinutes } from "@/lib/geo";
export * as taxonomy from "@/lib/taxonomy";
