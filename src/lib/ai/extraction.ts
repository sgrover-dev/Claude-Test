import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AMENITIES, CUISINES, FOOD_STYLES, SPACE_TYPES } from "@/lib/taxonomy";
import { AI_MODEL, describeError, getAnthropic, type AiMeta } from "./client";
import { ExtractedInventorySchema, type ExtractedInventory, type ExtractedSpace } from "./schemas";

const keysList = (o: readonly { key: string; label: string }[]) => o.map((x) => `${x.key} (${x.label})`).join(", ");

export type ExtractionResult = { inventory: ExtractedInventory; meta: AiMeta & { error?: string } };

/**
 * Heuristic extractor used without AI credentials. Finds capacity statements
 * and treats the nearest preceding heading-like line as the space name.
 * Everything it produces is low confidence and lands in the review queue.
 */
export function extractInventoryFallback(text: string, hints: { title?: string | null; url?: string | null } = {}): ExtractedInventory {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const spaces: ExtractedSpace[] = [];
  const seen = new Set<string>();
  const capRe = /(?:seats?|seating for|accommodates?|holds?|up to|capacity(?: of)?|for up to|host(?:s)? up to)\s*(\d{1,3})(?:\s*(?:-|–|to)\s*(\d{1,3}))?\s*(?:guests?|people|seated|persons|diners)?/i;
  const standRe = /(\d{1,3})\s*(?:standing|reception|cocktail[- ]style)/i;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const cap = line.match(capRe);
    if (!cap) continue;
    let name: string | null = null;
    for (let back = idx; back >= Math.max(0, idx - 6); back--) {
      const cand = lines[back].replace(cap[0], "").trim();
      if (cand.length >= 3 && cand.length <= 48 && !/[.!?]$/.test(cand) && /^[A-Z]/.test(cand) && !/^(seats|accommodates|capacity|up to)/i.test(cand)) {
        name = cand.replace(/[:\-–]\s*$/, "").trim();
        break;
      }
    }
    if (!name) name = `Space ${spaces.length + 1}`;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const context = lines.slice(Math.max(0, idx - 2), idx + 3).join(" ");
    const low = parseInt(cap[1], 10);
    const high = cap[2] ? parseInt(cap[2], 10) : null;
    const standing = context.match(standRe);
    const money = context.match(/\$\s?([\d,]+)\s*(?:minimum|min\b|f&b)/i);
    const room = context.match(/\$\s?([\d,]+)\s*(?:room|rental)\s*fee/i);
    const lc = context.toLowerCase();
    const amenities: ExtractedSpace["amenities"] = [];
    for (const a of AMENITIES) if (lc.includes(a.label.toLowerCase().split(" ")[0]) && a.key !== "parking") amenities.push(a.key);
    spaces.push({
      name,
      description: context.slice(0, 280),
      spaceType: /patio|terrace|garden|courtyard/i.test(name) ? "patio" : /roof/i.test(name) ? "rooftop" : /wine|cellar/i.test(name) ? "wine_room" : /chef/i.test(name) ? "chefs_table" : /bar|lounge/i.test(name) ? "bar_lounge" : /buyout|entire|whole/i.test(name) ? "full_buyout" : /private/i.test(context) ? "private_dining_room" : null,
      privacy: /semi[- ]private/i.test(context) ? "semi_private" : /private/i.test(context) ? "fully_private" : /buyout/i.test(context) ? "buyout" : null,
      indoorOutdoor: /patio|terrace|garden|courtyard|rooftop|outdoor/i.test(context) ? "outdoor" : null,
      minGuests: null,
      maxSeated: high ?? low,
      maxStanding: standing ? parseInt(standing[1], 10) : null,
      roomFeeCents: room ? parseInt(room[1].replace(/,/g, ""), 10) * 100 : null,
      fbMinimumCents: money ? parseInt(money[1].replace(/,/g, ""), 10) * 100 : null,
      estPerPersonLowCents: null,
      estPerPersonHighCents: null,
      depositCents: null,
      serviceChargePct: null,
      amenities,
      foodStyles: FOOD_STYLES.filter((f) => lc.includes(f.label.toLowerCase())).map((f) => f.key),
      availabilityNotes: null,
      pricingNotes: null,
      evidence: line.slice(0, 200),
      confidence: 0.35,
    });
  }

  const phone = text.match(/\(?\b\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/);
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const address = text.match(/\b\d{2,5}\s+[A-Z][A-Za-z0-9.'\s]{2,40}\b(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Pkwy|Fwy|Hwy)\b\.?/);
  const cuisines = CUISINES.filter((c) => new RegExp(`\\b${c.label.toLowerCase()}\\b`).test(text.toLowerCase())).map((c) => c.key).slice(0, 3);

  return {
    restaurant: {
      name: hints.title?.split(/[|–-]/)[0].trim() ?? null,
      description: null,
      cuisines,
      addressLine1: address?.[0] ?? null,
      cityName: null,
      state: null,
      postalCode: null,
      phone: phone?.[0] ?? null,
      eventsContactName: null,
      eventsContactEmail: email?.[0] ?? null,
      eventsContactPhone: null,
      eventsPageUrl: hints.url ?? null,
      menuUrls: [],
      confidence: 0.3,
    },
    spaces,
    notes: "Rule-based extraction (no AI credentials configured). Review carefully.",
  };
}

export async function extractInventory(text: string, hints: { title?: string | null; url?: string | null } = {}): Promise<ExtractionResult> {
  const client = getAnthropic();
  if (!client) return { inventory: extractInventoryFallback(text, hints), meta: { provider: "fallback", model: null } };
  const trimmed = text.length > 60_000 ? text.slice(0, 60_000) : text;
  try {
    const response = await client.messages.parse({
      model: AI_MODEL,
      max_tokens: 8000,
      output_config: { format: zodOutputFormat(ExtractedInventorySchema), effort: "medium" },
      system: `You extract structured private-dining inventory from restaurant web pages and event packets for Red Rope. Return one candidate per distinct reservable space (private dining room, semi-private room, patio, rooftop, wine room, chef's table, bar/lounge, event room, full buyout). Money in integer cents. Use null whenever the source does not state a value — never infer prices or capacities. Quote a short supporting excerpt in "evidence". Set confidence per space (0–1) based on how explicit the source is.
Allowed keys — spaceType: ${keysList(SPACE_TYPES)}; amenities: ${keysList(AMENITIES)}; foodStyles: ${keysList(FOOD_STYLES)}; cuisines: ${keysList(CUISINES)}.`,
      messages: [
        {
          role: "user",
          content: `Source URL: ${hints.url ?? "n/a"}\nPage title: ${hints.title ?? "n/a"}\n\nContent:\n"""\n${trimmed}\n"""`,
        },
      ],
    });
    if (response.stop_reason !== "refusal" && response.parsed_output) {
      return { inventory: response.parsed_output, meta: { provider: "anthropic", model: AI_MODEL } };
    }
    return { inventory: extractInventoryFallback(text, hints), meta: { provider: "fallback", model: null, error: "Model declined; used rule-based extraction." } };
  } catch (error) {
    return { inventory: extractInventoryFallback(text, hints), meta: { provider: "fallback", model: null, error: describeError(error) } };
  }
}
