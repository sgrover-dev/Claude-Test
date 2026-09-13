# Deploying Red Rope (Supabase + Vercel)

The app is a standard Next.js server app on plain Postgres. Nothing is Supabase-specific; Supabase is simply a convenient hosted Postgres.

## 1. Database on Supabase (about 5 minutes)

1. Create a project at https://supabase.com/dashboard (any region; Postgres 15+ is fine).
2. Open **Project Settings → Database → Connection string** and copy the **URI**. Use the *Session* pooler string (port 5432) for migrations and seeding, and either the session or *Transaction* pooler (port 6543) for the running app. Both look like:
   ```
   postgres://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```
3. Supabase requires TLS. Set both variables locally:
   ```bash
   export DATABASE_URL="postgres://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
   export DATABASE_SSL=true
   ```
4. From the repo (`claude/hopeful-davinci-4pajuj` branch, `npm install` done):
   ```bash
   npm run db:migrate     # creates all tables (drizzle/ migrations)
   npm run db:seed        # Houston city + neighborhoods, imports data/imports/houston-venues.csv, creates admin user(s)
   ```
   `ADMIN_EMAILS` controls which sign-in emails get console access; set it before seeding (comma-separated).

## 2. App on Vercel

1. Import the GitHub repo in Vercel and pick the `claude/hopeful-davinci-4pajuj` branch (or merge it to main first). Framework preset: Next.js. No build settings need changing.
2. Environment variables (Production):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Supabase pooler URI (transaction pooler, port 6543, is fine for the app) |
   | `DATABASE_SSL` | `true` |
   | `DATABASE_POOL_MAX` | `5` (serverless functions; keep small) |
   | `SESSION_SECRET` | `openssl rand -hex 32` |
   | `NEXT_PUBLIC_APP_URL` | your deployment URL, e.g. `https://redrope.vercel.app` |
   | `ADMIN_EMAILS` | your email(s) |
   | `EMAIL_PROVIDER` | `resend` (and `RESEND_API_KEY`, `EMAIL_FROM`) — magic links need real email in production |
   | `ANTHROPIC_API_KEY` | optional; enables model-backed concierge, drafting and extraction |
   | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | optional; enables deposit collection |
   | `STORAGE_DIR` | leave unset for now; uploaded photos/PDFs use local disk, which is ephemeral on Vercel. Link by URL instead, or swap `src/lib/storage.ts` for S3/Supabase Storage. |

3. Deploy. Then sign in at `/login` with an `ADMIN_EMAILS` address; the console is at `/admin`.
4. Stripe (optional): add a webhook in the Stripe dashboard pointing at `https://<your-domain>/api/stripe/webhook` for the `checkout.session.completed` event and paste the signing secret into `STRIPE_WEBHOOK_SECRET`.

## 3. Ongoing

- Schema changes: edit `src/db/schema.ts`, run `npm run db:generate`, commit the new file under `drizzle/`, run `npm run db:migrate` against production.
- New inventory: upload a CSV in `/admin/ingestion` (reviewed) or run `npm run db:seed path/to.csv` (direct apply, fills blanks only).
- Health: `/admin` shows AI, payments and email integration status at the top.
