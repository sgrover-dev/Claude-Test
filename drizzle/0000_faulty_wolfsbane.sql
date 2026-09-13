CREATE TYPE "public"."actor_type" AS ENUM('ops', 'customer', 'venue', 'ai', 'system');--> statement-breakpoint
CREATE TYPE "public"."ai_draft_kind" AS ENUM('venue_outreach', 'venue_follow_up', 'customer_update', 'response_summary', 'quote_extraction', 'quote_comparison');--> statement-breakpoint
CREATE TYPE "public"."ai_draft_status" AS ENUM('draft', 'approved', 'rejected', 'sent');--> statement-breakpoint
CREATE TYPE "public"."availability_mode" AS ENUM('request', 'rules', 'instant');--> statement-breakpoint
CREATE TYPE "public"."candidate_status" AS ENUM('not_contacted', 'contacted', 'follow_up_due', 'available', 'unavailable', 'needs_clarification', 'quote_received', 'customer_rejected', 'customer_selected');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."fact_confidence" AS ENUM('verified', 'publicly_listed', 'estimate', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('menu', 'private_dining_packet', 'contract', 'floor_plan', 'other');--> statement-breakpoint
CREATE TYPE "public"."entity_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."extraction_candidate_status" AS ENUM('pending', 'approved', 'rejected', 'merged');--> statement-breakpoint
CREATE TYPE "public"."indoor_outdoor" AS ENUM('indoor', 'outdoor', 'covered_outdoor', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."ingestion_source" AS ENUM('manual', 'csv', 'url', 'ai_web', 'pdf', 'provider', 'claim');--> statement-breakpoint
CREATE TYPE "public"."ingestion_status" AS ENUM('queued', 'running', 'needs_review', 'completed', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."inquiry_status" AS ENUM('draft', 'submitted', 'researching', 'contacting_venues', 'awaiting_venue', 'options_available', 'customer_reviewing', 'customer_selected', 'deposit_required', 'booking_pending', 'booked', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('red_rope_deposit', 'concierge_fee', 'booking_fee');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."privacy_level" AS ENUM('fully_private', 'semi_private', 'shared', 'buyout');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('restaurant_website', 'private_dining_pdf', 'phone_confirmation', 'email_confirmation', 'restaurant_claimed', 'public_listing', 'red_rope_research', 'csv_import', 'ai_extraction', 'manual_entry');--> statement-breakpoint
CREATE TYPE "public"."space_type" AS ENUM('private_dining_room', 'semi_private_room', 'patio', 'rooftop', 'wine_room', 'chefs_table', 'bar_lounge', 'dining_section', 'upstairs_room', 'event_room', 'full_buyout', 'other');--> statement-breakpoint
CREATE TYPE "public"."timeline_kind" AS ENUM('email_out', 'email_in', 'phone_call', 'note', 'quote', 'contract', 'menu', 'deposit_request', 'customer_message', 'customer_update', 'status_change', 'ai_summary', 'system');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('consumer', 'ops', 'admin');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('unverified', 'publicly_listed', 'verified');--> statement-breakpoint
CREATE TABLE "ai_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"candidate_id" uuid,
	"kind" "ai_draft_kind" NOT NULL,
	"subject" text,
	"content" text NOT NULL,
	"structured" jsonb,
	"status" "ai_draft_status" DEFAULT 'draft' NOT NULL,
	"model" text,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" time,
	"end_time" time,
	"label" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"state" text NOT NULL,
	"country" text DEFAULT 'US' NOT NULL,
	"timezone" text DEFAULT 'America/Chicago' NOT NULL,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"kind" "document_kind" DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"storage_key" text,
	"mime_type" text,
	"extracted_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extraction_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"candidate_type" text NOT NULL,
	"parent_candidate_id" uuid,
	"payload" jsonb NOT NULL,
	"field_confidence" jsonb,
	"overall_confidence" numeric(4, 3),
	"source_url" text,
	"status" "extraction_candidate_status" DEFAULT 'pending' NOT NULL,
	"applied_entity_id" uuid,
	"reviewer_notes" text,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fact_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"field" text,
	"source_type" "source_type" NOT NULL,
	"source_url" text,
	"document_id" uuid,
	"confidence" "fact_confidence" DEFAULT 'unknown' NOT NULL,
	"verification_method" text,
	"extracted_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"note" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "ingestion_source" NOT NULL,
	"status" "ingestion_status" DEFAULT 'queued' NOT NULL,
	"input_url" text,
	"input_label" text,
	"target_restaurant_id" uuid,
	"raw_payload" jsonb,
	"summary" text,
	"error" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"user_id" uuid,
	"city_id" uuid,
	"status" "inquiry_status" DEFAULT 'submitted' NOT NULL,
	"assigned_to_user_id" uuid,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"company" text,
	"event_type" text,
	"event_date" date,
	"start_time" time,
	"time_flexibility" text,
	"duration_minutes" integer,
	"guest_count" integer NOT NULL,
	"budget_cents" integer,
	"budget_is_per_person" boolean DEFAULT false NOT NULL,
	"food_preferences" text,
	"dietary_needs" text,
	"av_requirements" text,
	"privacy_requirement" "privacy_level",
	"special_requests" text,
	"search_snapshot" jsonb,
	"attribution" jsonb,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inquiry_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"space_id" uuid NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"is_preferred" boolean DEFAULT false NOT NULL,
	"status" "candidate_status" DEFAULT 'not_contacted' NOT NULL,
	"last_contact_at" timestamp with time zone,
	"next_follow_up_at" timestamp with time zone,
	"decline_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inquiry_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"candidate_id" uuid,
	"kind" timeline_kind NOT NULL,
	"actor_type" "actor_type" DEFAULT 'ops' NOT NULL,
	"actor_user_id" uuid,
	"subject" text,
	"body" text,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"city_id" uuid NOT NULL,
	"neighborhood_id" uuid,
	"slug" text NOT NULL,
	"name" text,
	"address_line1" text,
	"address_line2" text,
	"city_name" text,
	"state" text,
	"postal_code" text,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6),
	"phone" text,
	"parking_notes" text,
	"has_valet" boolean,
	"has_parking_lot" boolean,
	"is_wheelchair_accessible" boolean,
	"status" "entity_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"redirect_to" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "neighborhoods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inquiry_id" uuid,
	"user_id" uuid,
	"kind" "payment_kind" NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"raw_text" text,
	"guest_count" integer,
	"fb_minimum_cents" integer,
	"room_fee_cents" integer,
	"per_person_cents" integer,
	"service_charge_pct" numeric(5, 2),
	"admin_fee_pct" numeric(5, 2),
	"tax_pct" numeric(5, 2),
	"deposit_cents" integer,
	"minimum_includes_room_fee" boolean,
	"minimum_includes_service_and_tax" boolean,
	"inclusions" text,
	"cancellation_terms" text,
	"normalized" jsonb,
	"assumptions" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "claim_status" DEFAULT 'pending' NOT NULL,
	"verification_method" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cuisines" text[] DEFAULT '{}'::text[] NOT NULL,
	"price_tier" integer,
	"website_url" text,
	"events_page_url" text,
	"phone" text,
	"email" text,
	"events_contact_name" text,
	"events_contact_email" text,
	"events_contact_phone" text,
	"contact_verified_at" timestamp with time zone,
	"hero_image_url" text,
	"status" "entity_status" DEFAULT 'active' NOT NULL,
	"claimed_by_user_id" uuid,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"inquiry_id" uuid,
	"user_id" uuid,
	"overall_rating" integer,
	"privacy_accurate" boolean,
	"capacity_accurate" boolean,
	"av_worked" boolean,
	"staff_rating" integer,
	"booking_process_rating" integer,
	"value_rating" integer,
	"suitability_rating" integer,
	"body" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"query" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"space_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"user_id" uuid,
	"visitor_id" text,
	"referrer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"space_type" "space_type" DEFAULT 'other' NOT NULL,
	"privacy" "privacy_level",
	"indoor_outdoor" "indoor_outdoor",
	"min_guests" integer,
	"max_seated" integer,
	"max_standing" integer,
	"configurations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"room_fee_cents" integer,
	"fb_minimum_cents" integer,
	"est_per_person_low_cents" integer,
	"est_per_person_high_cents" integer,
	"daypart_minimums" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deposit_cents" integer,
	"deposit_notes" text,
	"service_charge_pct" numeric(5, 2),
	"admin_fee_pct" numeric(5, 2),
	"tax_pct" numeric(5, 2),
	"cancellation_policy" text,
	"pricing_notes" text,
	"amenities" text[] DEFAULT '{}'::text[] NOT NULL,
	"food_styles" text[] DEFAULT '{}'::text[] NOT NULL,
	"ambiance" text[] DEFAULT '{}'::text[] NOT NULL,
	"suitable_for" text[] DEFAULT '{}'::text[] NOT NULL,
	"dietary_accommodations" text,
	"menu_notes" text,
	"availability_mode" "availability_mode" DEFAULT 'request' NOT NULL,
	"availability_notes" text,
	"max_duration_minutes" integer,
	"age_restriction" text,
	"decor_policy" text,
	"outside_cake_policy" text,
	"outside_vendor_policy" text,
	"other_restrictions" text,
	"status" "entity_status" DEFAULT 'active' NOT NULL,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"completeness_score" integer DEFAULT 0 NOT NULL,
	"merged_into_space_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"phone" text,
	"role" "user_role" DEFAULT 'consumer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_candidate_id_inquiry_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."inquiry_candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_candidates" ADD CONSTRAINT "extraction_candidates_job_id_ingestion_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."ingestion_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact_sources" ADD CONSTRAINT "fact_sources_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_target_restaurant_id_restaurants_id_fk" FOREIGN KEY ("target_restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_candidates" ADD CONSTRAINT "inquiry_candidates_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_candidates" ADD CONSTRAINT "inquiry_candidates_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_events" ADD CONSTRAINT "inquiry_events_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_events" ADD CONSTRAINT "inquiry_events_candidate_id_inquiry_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."inquiry_candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_neighborhood_id_neighborhoods_id_fk" FOREIGN KEY ("neighborhood_id") REFERENCES "public"."neighborhoods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "neighborhoods" ADD CONSTRAINT "neighborhoods_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_candidate_id_inquiry_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."inquiry_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_claims" ADD CONSTRAINT "restaurant_claims_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_claims" ADD CONSTRAINT "restaurant_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_spaces" ADD CONSTRAINT "saved_spaces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_spaces" ADD CONSTRAINT "saved_spaces_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_photos" ADD CONSTRAINT "space_photos_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_views" ADD CONSTRAINT "space_views_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_drafts_inquiry_idx" ON "ai_drafts" USING btree ("inquiry_id");--> statement-breakpoint
CREATE INDEX "availability_rules_space_idx" ON "availability_rules" USING btree ("space_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cities_slug_idx" ON "cities" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "documents_entity_idx" ON "documents" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "extraction_candidates_job_idx" ON "extraction_candidates" USING btree ("job_id","status");--> statement-breakpoint
CREATE INDEX "fact_sources_entity_idx" ON "fact_sources" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "ingestion_jobs_status_idx" ON "ingestion_jobs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "inquiries_number_idx" ON "inquiries" USING btree ("number");--> statement-breakpoint
CREATE INDEX "inquiries_status_idx" ON "inquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inquiries_user_idx" ON "inquiries" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inquiry_candidates_unique_idx" ON "inquiry_candidates" USING btree ("inquiry_id","space_id");--> statement-breakpoint
CREATE INDEX "inquiry_candidates_space_idx" ON "inquiry_candidates" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "inquiry_events_inquiry_idx" ON "inquiry_events" USING btree ("inquiry_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_restaurant_slug_idx" ON "locations" USING btree ("restaurant_id","slug");--> statement-breakpoint
CREATE INDEX "locations_city_idx" ON "locations" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "locations_neighborhood_idx" ON "locations" USING btree ("neighborhood_id");--> statement-breakpoint
CREATE UNIQUE INDEX "magic_links_token_idx" ON "magic_links" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "neighborhoods_city_slug_idx" ON "neighborhoods" USING btree ("city_id","slug");--> statement-breakpoint
CREATE INDEX "payments_inquiry_idx" ON "payments" USING btree ("inquiry_id");--> statement-breakpoint
CREATE INDEX "quotes_inquiry_idx" ON "quotes" USING btree ("inquiry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurants_slug_idx" ON "restaurants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "saved_searches_user_idx" ON "saved_searches" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_spaces_user_space_idx" ON "saved_spaces" USING btree ("user_id","space_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_idx" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "space_photos_space_idx" ON "space_photos" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "space_views_space_idx" ON "space_views" USING btree ("space_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "spaces_slug_idx" ON "spaces" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "spaces_location_idx" ON "spaces" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "spaces_status_idx" ON "spaces" USING btree ("status");--> statement-breakpoint
CREATE INDEX "spaces_capacity_idx" ON "spaces" USING btree ("min_guests","max_seated","max_standing");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");