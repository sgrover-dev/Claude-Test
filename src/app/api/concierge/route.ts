import { NextResponse } from "next/server";
import { z } from "zod";
import { interpretRequest } from "@/lib/ai/concierge";
import { getCityBySlug, neighborhoodHints } from "@/lib/data/cities";
import { searchHref } from "@/lib/search/params";
import { DEFAULT_CITY } from "@/lib/search/types";

const Body = z.object({ text: z.string().min(3).max(2000), city: z.string().optional() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Tell us a bit more about what you need." }, { status: 400 });
  const citySlug = parsed.data.city ?? DEFAULT_CITY;
  const city = await getCityBySlug(citySlug);
  if (!city) return NextResponse.json({ error: "Unknown city" }, { status: 404 });
  const hints = await neighborhoodHints(city.id);
  const result = await interpretRequest(parsed.data.text, { cityName: city.name, neighborhoods: hints });
  const href = searchHref({ ...result.filters, city: citySlug }) + (searchHref({ ...result.filters, city: citySlug }).includes("?") ? "&" : "?") + "concierge=1";
  return NextResponse.json({
    href,
    summary: result.interpretation.summary,
    unresolved: result.interpretation.unresolved,
    filters: result.filters,
    provider: result.meta.provider,
    model: result.meta.model,
    error: result.meta.error ?? null,
  });
}
