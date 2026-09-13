# Architecture

## Principles

1. **The atomic unit is the space.** `restaurants → locations → spaces`. Search, cards, SEO and inquiries all key on spaces; the restaurant is context.
2. **Restaurants don't have to participate.** Inventory is built from public materials + Red Rope research; ops bridges the gap. The schema carries `claimed_by_user_id`, `restaurant_claims` and `availability_mode` so claiming, self-service editing and instant book can be added without migration pain.
3. **Never present uncertain data as fact.** Every meaningful fact can carry provenance (`fact_sources`: source type, URL, field, confidence, extraction/verification dates). The UI labels values as *verified*, *publicly listed*, *Red Rope estimate* or *unknown*. Nulls mean unknown; nothing is invented.
4. **Humans approve anything that leaves the building.** AI drafts (`ai_drafts`) sit in `draft` until an operator approves; sending is a separate explicit step that is logged.
5. **Cities are configuration.** `cities`/`neighborhoods` tables with aliases; the default city is a constant in `lib/search/types.ts`, not a hard-coded assumption in business logic.

## Layout

```
src/
  db/            schema.ts (Drizzle, Postgres), index.ts (pool), seed.ts, reset.ts, seed-data/ (city + neighborhoods)
  lib/
    taxonomy.ts  amenities, event types, cuisines, ambiance, occasions (SEO pages) — stable keys
    search/      params (URL ↔ filters), rank (scoring + reasons), estimate (spend estimate)
    quotes/      normalize (comparable all-in numbers + assumptions), parse (pricing text → fields)
    inquiries/   state machine for inquiry + venue-candidate statuses, follow-up rules
    inventory/   completeness scoring, staleness, dedupe helpers
    ingestion/   types (InventoryPayload), csv, pricing/capacity parsers, amenity mapping, web fetch, jobs, apply
    ai/          client, zod schemas, concierge (discovery), logistics (outreach/summaries/updates/compare), extraction, fallback (rule-based)
    data/        query modules used by pages (cities, spaces, inquiries, saved, admin)
    auth/        magic links + sessions (httpOnly cookie, hashed tokens)
    email/       provider abstraction (console | resend)
    payments/    Stripe deposits (Red Rope side only)
    storage.ts   file storage abstraction (local disk; swap for S3)
  app/
    (site)/      consumer marketplace
    admin/       inventory + operations console (role-gated)
    api/         concierge, view beacon, files, payments checkout, stripe webhook
    actions/     server actions shared by consumer pages
```

## Data model highlights

- **spaces**: identity, capacity (`min_guests`, `max_seated`, `max_standing`, `configurations` JSON), privacy, pricing in integer cents (`fb_minimum_cents`, `room_fee_cents`, per-person low/high, `daypart_minimums` JSON, deposit, service/admin/tax pct, cancellation), amenities/food styles/ambiance/`suitable_for` as `text[]`, operational policies, `availability_mode` (request | rules | instant) + `availability_rules`, `verification_status`, `last_verified_at`, `completeness_score`, `merged_into_space_id`.
- **fact_sources**: `(entity_type, entity_id, field?)` → source type, URL, document, confidence, dates, note. Multiple rows per field are allowed; the highest confidence wins for display (`fieldConfidence` in `PricingBlock`).
- **inquiries** + **inquiry_candidates** (per-venue status, last contact, next follow-up, decline reason) + **inquiry_events** (structured timeline: email in/out, call, note, quote, contract, menu, deposit request, customer message/update, status change, AI summary) + **quotes** (raw + structured + `normalized` JSON + assumptions) + **ai_drafts** + **payments**.
- **ingestion_jobs** + **extraction_candidates** (payload = `InventoryPayload`, per-field confidence, review status, applied entity).
- Future-facing, schema only: **restaurant_claims**, **reviews** (event-space experience, not food), **space_views** (demand analytics that power the "claim your listing" message), inquiry `attribution` JSON for monetization/attribution.

## Search

1. SQL hard filters: active entities, city, plausible capacity (max ≥ guests / 1.1, or unknown capacity kept and flagged).
2. `rankSpaces` scores in memory (Houston-scale inventory) with explainable reasons and warnings: capacity fit, privacy match, budget vs estimated all-in spend, AV/display/bar/parking/accessibility, cuisine/ambiance/food style, setting/type, event suitability, neighborhood/distance, text match, verification and completeness bonuses.
3. When a neighborhood is requested, results are split into *in neighborhood* and *nearby*.
4. Spend estimates reuse the quote normalizer with the space's stored pricing and city tax defaults, so search, space pages, compare and ops all agree.

## Quote normalization

`normalizeQuote(input, { defaultTaxPct, defaultServiceChargePct })` handles the common shapes — F&B minimum + gratuity + tax; per-person + room fee; minimum inclusive of room; all-inclusive minimums; per-person ranges — and returns food/beverage, room fee, service, admin fee, tax, deposit, all-in and per-person figures with a list of explicit assumptions and a confidence level. `parseQuoteText` and `parsePricingText` extract fields from restaurant language without inventing values.

## Ingestion pipeline

Every source produces the same `InventoryPayload` (restaurant + location + spaces with provenance), and `applyInventoryPayload` is the single writer (upsert by slug/name, provenance and documents deduped, completeness recomputed, neighborhood centroid used as an *estimated* coordinate when an address hasn't been geocoded).

| Source | Path |
|---|---|
| Manual | Admin forms → `saveRestaurant` / `saveLocation` / `saveSpace` (edits can record their source) |
| CSV | `parseVenueCsv` → review queue or direct apply |
| URL | `fetchPageText` (cheerio, PDF links, related event pages) → `extractInventory` → review |
| Pasted text / PDF | `pdfToText` → `extractInventory` → review |
| AI extraction | Claude structured outputs with evidence + per-space confidence; rule-based fallback without a key |
| Future providers / claims | implement `InventoryPayload` producers; nothing else changes |

## AI

- Model calls go through `@anthropic-ai/sdk` with `messages.parse` + `zodOutputFormat` so every result is schema-validated. Refusals and errors fall back to deterministic code paths and are surfaced in the UI.
- Discovery: `interpretRequest` → filters (never invents guest counts/dates/budgets).
- Logistics: `draftVenueOutreach`, `summarizeVenueResponse` (availability, quote, unanswered questions, suggested candidate status), `draftCustomerUpdate`, `compareQuotes` (deterministic).
- Autonomy boundary: drafts are persisted with `status = draft`; only `reviewDraft(approve_send)` sends, through the email provider, and logs the event. Autonomous sending later = a policy flag on that action.

## Auth, roles, payments

- Magic links: hashed tokens, 15-minute expiry, single use; sessions are httpOnly cookies backed by `sessions`. Emails listed in `ADMIN_EMAILS` get the `admin` role on login; `ops` is a lighter staff role.
- Stripe: `payments` rows are created by ops (`requestDeposit`); the customer opens Checkout from their tracking page; the webhook marks the payment succeeded and advances the inquiry. Restaurant payouts (Stripe Connect) are intentionally not built.

## Deliberately deferred

Restaurant portal / claiming UI (schema exists), instant booking, calendar/email/telephony integrations (timeline is manual-first but structured for them), geocoding (locations currently fall back to neighborhood centroids marked as estimates), reviews UI, multi-city UI switcher, object storage (local disk adapter in place), background job queue (ingestion runs inline).
