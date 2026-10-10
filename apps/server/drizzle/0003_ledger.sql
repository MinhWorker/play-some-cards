CREATE TABLE "balances" (
	"user_id" uuid NOT NULL,
	"resource" text NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "balances_user_id_resource_pk" PRIMARY KEY("user_id","resource")
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"resource" text NOT NULL,
	"amount" bigint NOT NULL,
	"reason" text NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "balances" ADD CONSTRAINT "balances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_entries_user_id_idx" ON "ledger_entries" USING btree ("user_id");