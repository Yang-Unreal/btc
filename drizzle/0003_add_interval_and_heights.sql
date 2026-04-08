CREATE TABLE "price_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text DEFAULT 'BTC' NOT NULL,
	"target_price" numeric NOT NULL,
	"direction" text DEFAULT 'CROSSING' NOT NULL,
	"enabled" text DEFAULT 'true' NOT NULL,
	"triggered" text DEFAULT 'false' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "interval" text DEFAULT '1h' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "indicators" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "indicator_heights" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "notifications_enabled" text DEFAULT 'true' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "four_h_alert_enabled" text DEFAULT 'false' NOT NULL;