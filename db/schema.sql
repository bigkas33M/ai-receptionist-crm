

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."tg_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


ALTER FUNCTION "public"."tg_set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid",
    "start_ts" timestamp with time zone,
    "end_ts" timestamp with time zone,
    "address" "text",
    "notes" "text",
    "gcal_event_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid",
    "sms_opt_in" boolean,
    "email_opt_in" boolean,
    "ts" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."consents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid",
    "tag" "text",
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contact_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "phone" "text" NOT NULL,
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "region" "text",
    "address" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid",
    "lead_id" "uuid",
    "intent" "text",
    "summary" "text",
    "transcript_url" "text",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "started_at" timestamp with time zone,
    "duration_s" integer,
    "direction" "text",
    "channel" "text" DEFAULT 'voice'::"text",
    "recording_url" "text",
    "cost_cents" integer,
    "vapi_call_id" "text",
    "provider_meta" "jsonb",
    CONSTRAINT "interactions_channel_check" CHECK (("channel" = ANY (ARRAY['voice'::"text", 'chat'::"text", 'sms'::"text", 'other'::"text"]))),
    CONSTRAINT "interactions_direction_check" CHECK (("direction" = ANY (ARRAY['in'::"text", 'out'::"text"])))
);


ALTER TABLE "public"."interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid",
    "tag" "text",
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lead_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid",
    "service_type" "text",
    "building_type" "text",
    "address" "text",
    "city" "text",
    "scope_notes" "text",
    "has_asbestos" boolean,
    "budget_band" "text",
    "timeline" "text",
    "status" "text" DEFAULT 'new'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "urgency" "text",
    "score_int" integer,
    "tag" "text",
    "region" "text",
    CONSTRAINT "leads_tag_check" CHECK (("tag" = ANY (ARRAY['hot'::"text", 'warm'::"text", 'cold'::"text"]))),
    CONSTRAINT "leads_urgency_check" CHECK (("urgency" = ANY (ARRAY['faible'::"text", 'moyenne'::"text", 'haute'::"text"])))
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consents"
    ADD CONSTRAINT "consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_tags"
    ADD CONSTRAINT "contact_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interactions"
    ADD CONSTRAINT "interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_tags"
    ADD CONSTRAINT "lead_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_appointments_start" ON "public"."appointments" USING "btree" ("start_ts");



CREATE INDEX "idx_contact_tags_tag" ON "public"."contact_tags" USING "btree" ("tag");



CREATE INDEX "idx_contacts_email_trgm" ON "public"."contacts" USING "gin" ("email" "public"."gin_trgm_ops");



CREATE INDEX "idx_contacts_phone_trgm" ON "public"."contacts" USING "gin" ("phone" "public"."gin_trgm_ops");



CREATE INDEX "idx_interactions_contact" ON "public"."interactions" USING "btree" ("contact_id");



CREATE INDEX "idx_interactions_created_at" ON "public"."interactions" USING "btree" ("created_at");



CREATE INDEX "idx_lead_tags_tag" ON "public"."lead_tags" USING "btree" ("tag");



CREATE INDEX "idx_leads_service" ON "public"."leads" USING "btree" ("service_type");



CREATE INDEX "idx_leads_status" ON "public"."leads" USING "btree" ("status");



CREATE UNIQUE INDEX "uq_contact_tags" ON "public"."contact_tags" USING "btree" ("contact_id", "tag");



CREATE UNIQUE INDEX "uq_contacts_email" ON "public"."contacts" USING "btree" ("lower"("email")) WHERE ("email" IS NOT NULL);



CREATE UNIQUE INDEX "uq_contacts_phone" ON "public"."contacts" USING "btree" ("lower"("phone")) WHERE ("phone" IS NOT NULL);



CREATE UNIQUE INDEX "uq_lead_tags" ON "public"."lead_tags" USING "btree" ("lead_id", "tag");



CREATE OR REPLACE TRIGGER "set_contacts_updated_at" BEFORE UPDATE ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



ALTER TABLE ONLY "public"."consents"
    ADD CONSTRAINT "consents_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_tags"
    ADD CONSTRAINT "contact_tags_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "fk_appointments_lead" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interactions"
    ADD CONSTRAINT "fk_interactions_contact" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interactions"
    ADD CONSTRAINT "fk_interactions_lead" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead_tags"
    ADD CONSTRAINT "lead_tags_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointments select (auth)" ON "public"."appointments" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."consents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "consents select (auth)" ON "public"."consents" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."contact_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contact_tags select (auth)" ON "public"."contact_tags" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contacts select (auth)" ON "public"."contacts" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."interactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "interactions select (auth)" ON "public"."interactions" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."lead_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_tags select (auth)" ON "public"."lead_tags" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leads select (auth)" ON "public"."leads" FOR SELECT TO "authenticated" USING (true);



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."consents" TO "anon";
GRANT ALL ON TABLE "public"."consents" TO "authenticated";
GRANT ALL ON TABLE "public"."consents" TO "service_role";



GRANT ALL ON TABLE "public"."contact_tags" TO "anon";
GRANT ALL ON TABLE "public"."contact_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_tags" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."interactions" TO "anon";
GRANT ALL ON TABLE "public"."interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."interactions" TO "service_role";



GRANT ALL ON TABLE "public"."lead_tags" TO "anon";
GRANT ALL ON TABLE "public"."lead_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_tags" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






RESET ALL;
