import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AMBIANCE, AMENITIES, CUISINES, EVENT_TYPES, FOOD_STYLES, SPACE_TYPES } from "@/lib/taxonomy";
import type { SearchFilters } from "@/lib/search/types";
import { AI_MODEL, describeError, getAnthropic, type AiMeta } from "./client";
import { interpretRequestFallback, type NeighborhoodHint } from "./fallback";
import { InterpretedRequestSchema, type InterpretedRequest } from "./schemas";

export type ConciergeResult = {
  interpretation: InterpretedRequest;
  filters: Partial<SearchFilters>;
  meta: AiMeta & { error?: string };
};

const keysList = (o: readonly { key: string; label: string }[]) => o.map((x) => `${x.key} (${x.label})`).join(", ");

function systemPrompt(cityName: string, neighborhoods: NeighborhoodHint[], today: string) {
  return `You are Red Rope's concierge. Red Rope helps people find reservable spaces inside restaurants (private dining rooms, patios, wine rooms, buyouts) for groups of 10–100 in ${cityName}.

Turn the user's request into structured search filters. Only extract what the user actually said or clearly implied; use null / empty arrays otherwise. Never invent a guest count, budget or date.

Today is ${today}. Resolve relative dates ("next Tuesday") to YYYY-MM-DD. "Evening"/"dinner" implies 19:00, "lunch" 12:00, "brunch" 11:00.

Budgets: "$100/person" → budgetCents=10000, budgetPerPerson=true. "$2,500" total → budgetCents=250000, budgetPerPerson=false.

Privacy: "our own area but not total privacy" → ["semi_private","fully_private"]. "private room" → ["fully_private"]. Buyouts only when explicitly asked.

A screen, TV, projector, slides or "presentation" → displayRequired=true and avRequired=true. Microphone/speakers → avRequired=true.

Neighborhood must be one of these slugs (match on aliases too): ${neighborhoods.map((n) => `${n.slug} [${[n.name, ...n.aliases].join(", ")}]`).join("; ")}. If the user names a landmark you cannot map, leave neighborhood null and mention it in unresolved.

Allowed keys —
eventType: ${keysList(EVENT_TYPES)}
cuisines: ${keysList(CUISINES)}
ambiance: ${keysList(AMBIANCE)} ("nice but not stuffy" → upscale + casual)
foodStyles: ${keysList(FOOD_STYLES)}
amenities: ${keysList(AMENITIES)}
spaceTypes: ${keysList(SPACE_TYPES)}

Write the summary as one friendly sentence in Red Rope's voice.`;
}

export async function interpretRequest(
  text: string,
  ctx: { cityName: string; neighborhoods: NeighborhoodHint[]; today?: Date },
): Promise<ConciergeResult> {
  const today = ctx.today ?? new Date();
  const client = getAnthropic();
  if (client) {
    try {
      const response = await client.messages.parse({
        model: AI_MODEL,
        max_tokens: 4000,
        output_config: { format: zodOutputFormat(InterpretedRequestSchema), effort: "low" },
        system: systemPrompt(ctx.cityName, ctx.neighborhoods, today.toISOString().slice(0, 10)),
        messages: [{ role: "user", content: text }],
      });
      if (response.stop_reason !== "refusal" && response.parsed_output) {
        const interpretation = response.parsed_output;
        return { interpretation, filters: toFilters(interpretation), meta: { provider: "anthropic", model: AI_MODEL } };
      }
    } catch (error) {
      const interpretation = interpretRequestFallback(text, ctx.neighborhoods, today);
      return { interpretation, filters: toFilters(interpretation), meta: { provider: "fallback", model: null, error: describeError(error) } };
    }
  }
  const interpretation = interpretRequestFallback(text, ctx.neighborhoods, today);
  return { interpretation, filters: toFilters(interpretation), meta: { provider: "fallback", model: null } };
}

export function toFilters(i: InterpretedRequest): Partial<SearchFilters> {
  return {
    neighborhood: i.neighborhood ?? undefined,
    date: i.date ?? undefined,
    startTime: i.startTime ?? undefined,
    guests: i.guests ?? undefined,
    eventType: i.eventType ?? undefined,
    budgetCents: i.budgetCents ?? undefined,
    budgetPerPerson: i.budgetPerPerson ?? undefined,
    privacy: i.privacy.length ? i.privacy : undefined,
    cuisines: i.cuisines.length ? i.cuisines : undefined,
    ambiance: i.ambiance.length ? i.ambiance : undefined,
    foodStyles: i.foodStyles.length ? i.foodStyles : undefined,
    indoorOutdoor: i.indoorOutdoor.length ? i.indoorOutdoor : undefined,
    amenities: i.amenities.length ? i.amenities : undefined,
    avRequired: i.avRequired || undefined,
    displayRequired: i.displayRequired || undefined,
    privateBar: i.privateBar || undefined,
    parking: i.parking || undefined,
    accessible: i.accessible || undefined,
    format: i.format ?? undefined,
    durationMinutes: i.durationMinutes ?? undefined,
    spaceTypes: i.spaceTypes.length ? i.spaceTypes : undefined,
  };
}
