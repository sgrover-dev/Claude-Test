# Red Rope

**Find a restaurant space for your group.** Red Rope is a marketplace for the reservable spaces *inside* restaurants — private dining rooms, semi-private sections, patios, wine rooms, chef's tables and full buyouts — for groups of 10–100. Consumers search structured inventory by capacity, privacy and price; Red Rope's concierge team handles the restaurant. Restaurants don't need an account to be listed.

Launch market: **Houston, TX**. Cities are data, not code.

## What's in the MVP

| Area | What works |
|---|---|
| **Consumer marketplace** | Home, structured search (location / date / time / guests + 15 optional filters), space-first results with match reasons, space profiles with confidence-labelled pricing and provenance, restaurant pages, side-by-side compare, saved spaces & searches, SEO landing pages (`/houston`, `/houston/[neighborhood]`, `/houston/[occasion]`), sitemap and JSON-LD. |
| **AI concierge (discovery)** | "Tell Red Rope what you're looking for" turns free text into filters via Claude structured outputs, with a deterministic rule-based fallback when no API key is configured. Filters stay editable. |
| **Booking / inquiry flow** | Pick one or several spaces → structured request (date, time range, guests, budget, AV, privacy, dietary…) → inquiry with candidate venues. No account needed; a magic link lets the customer track progress, choose an option, message Red Rope and pay a deposit. |
| **Operations console** | Inquiry board and per-inquiry workspace: candidate venues with their own status machine, follow-up detection, structured timeline (emails, calls, notes, quotes, deposits), quote recording + **normalization to comparable all-in numbers**, quote comparison, deposit requests. |
| **AI concierge (logistics)** | Draft venue outreach, log + summarize venue replies (availability, pricing, unanswered questions, suggested follow-ups), draft customer updates. **Every outbound message requires human approval.** |
| **Admin inventory console** | Dashboard of inventory quality, restaurants → locations → spaces CRUD, photos, menus/PDFs, availability rules, field-level provenance and verification, stale/missing-data filters, duplicate detection + merge, demand stats per restaurant ("182 people viewed your spaces"). |
| **Ingestion pipeline** | Manual, CSV (venue-research format, 138-row Houston dataset included), URL fetch + extraction, pasted text, PDF packets. AI-extracted data lands in a **review queue**; admins edit and approve before it becomes inventory. |
| **Accounts & payments** | Passwordless magic-link auth (console or Resend email provider). Stripe Checkout for Red Rope deposits/fees with webhook; restaurant settlement intentionally out of scope. |

## Stack

Next.js 16 (App Router, server actions) · TypeScript · Tailwind v4 · Drizzle ORM + Postgres · Anthropic SDK (`claude-opus-5`, structured outputs) · Stripe · Vitest · Playwright (e2e smoke).

## Getting started

```bash
cp .env.example .env            # set DATABASE_URL, SESSION_SECRET, ADMIN_EMAILS
npm install
npm run db:migrate              # applies drizzle/ migrations
npm run db:seed                 # Houston city + neighborhoods, imports data/imports/houston-venues.csv, creates admin user(s)
npm run dev
```

Open http://localhost:3000. Sign in at `/login` with an email from `ADMIN_EMAILS` — with `EMAIL_PROVIDER=console` the magic link is printed to the terminal **and shown on the page** in development. The console lives at `/admin`.

Optional integrations (everything degrades gracefully without them):

- `ANTHROPIC_API_KEY` — enables model-backed concierge parsing, drafting, reply summaries and web/PDF extraction. Without it, rule-based fallbacks run and the UI says so.
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — enables deposit collection. Webhook endpoint: `POST /api/stripe/webhook`.
- `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` — real email for magic links, customer updates and approved venue outreach.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `typecheck` · `test` | ESLint, `tsc`, Vitest unit tests (ranking, quote normalization, parsers, state machine, CSV import) |
| `npm run e2e` | Playwright smoke test against a running dev server: search → inquiry → customer tracking → ops workflow → admin pages → ingestion review |
| `npm run db:migrate` · `db:generate` · `db:studio` | Drizzle migrations / schema changes / data browser |
| `npm run db:seed [file.csv]` | Seed city + import a venue CSV (idempotent; fills blanks, never overwrites) |
| `npm run db:reset` | Truncate inventory + operational tables (dev only) |

## Importing inventory

The CSV format is the research sheet in `data/imports/houston-venues.csv` (one row per space; restaurant columns repeated; blank `space_name` rows are restaurant-level notes). Column aliases are accepted (`restaurant`, `space`, `seated`, `standing`, `features`, `sources`…). Pricing text is parsed conservatively into minimums / per-person / room fees / day-part minimums, amenities text is mapped to taxonomy keys, and every derived number is stored with provenance. Import from the console (`/admin/ingestion`, with review) or from the CLI (`npm run db:seed path/to.csv`, direct apply).

See [DEPLOY.md](./DEPLOY.md) for Supabase + Vercel steps and [ARCHITECTURE.md](./ARCHITECTURE.md) for the data model, ranking, quote normalization, the ingestion pipeline and what is deliberately deferred.
