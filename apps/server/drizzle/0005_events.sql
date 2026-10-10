CREATE TABLE "event_claims" (
	"user_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"tier" integer NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_claims_user_id_event_id_tier_pk" PRIMARY KEY("user_id","event_id","tier")
);
--> statement-breakpoint
CREATE TABLE "event_points" (
	"user_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"match_id" text NOT NULL,
	"points" integer NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_points_user_id_event_id_match_id_pk" PRIMARY KEY("user_id","event_id","match_id")
);
--> statement-breakpoint
ALTER TABLE "event_claims" ADD CONSTRAINT "event_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_points" ADD CONSTRAINT "event_points_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;