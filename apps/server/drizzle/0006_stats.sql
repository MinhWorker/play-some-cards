CREATE TABLE "achievements" (
	"user_id" uuid NOT NULL,
	"achievement_id" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "achievements_user_id_achievement_id_pk" PRIMARY KEY("user_id","achievement_id")
);
--> statement-breakpoint
CREATE TABLE "player_stats" (
	"user_id" uuid NOT NULL,
	"game_id" text NOT NULL,
	"name" text NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "player_stats_user_id_game_id_name_pk" PRIMARY KEY("user_id","game_id","name")
);
--> statement-breakpoint
CREATE TABLE "stat_matches" (
	"user_id" uuid NOT NULL,
	"match_id" text NOT NULL,
	"counted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stat_matches_user_id_match_id_pk" PRIMARY KEY("user_id","match_id")
);
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stat_matches" ADD CONSTRAINT "stat_matches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_stats_board" ON "player_stats" USING btree ("game_id","name","value");