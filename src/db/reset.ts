import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "./index";

/** Development helper: wipe inventory + operational data (keeps users and cities). */
async function main() {
  await db.execute(sql`truncate table
    space_views, reviews, payments, ai_drafts, quotes, inquiry_events, inquiry_candidates, inquiries,
    extraction_candidates, ingestion_jobs, restaurant_claims, saved_spaces, saved_searches,
    fact_sources, documents, availability_rules, space_photos, spaces, locations, restaurants
    restart identity cascade`);
  console.log("inventory and operational tables truncated");
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
