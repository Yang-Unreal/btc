CREATE TABLE "position_calculator" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"balance" numeric DEFAULT '10000' NOT NULL,
	"leverage" numeric DEFAULT '10' NOT NULL,
	"position_size" numeric DEFAULT '0.1' NOT NULL,
	"entry_price" text,
	"fee_rate" numeric DEFAULT '0.0432' NOT NULL,
	"order_type" text DEFAULT 'market' NOT NULL,
	"direction" text DEFAULT 'long' NOT NULL,
	"take_profit_orders" text,
	"stop_loss_orders" text,
	"entries" text,
	"show_averaging" text DEFAULT 'false' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pyramid_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entries" text NOT NULL,
	"current_price" numeric NOT NULL,
	"stop_loss" numeric NOT NULL,
	"is_short" text DEFAULT 'true' NOT NULL,
	"total_size" numeric NOT NULL,
	"avg_price" numeric NOT NULL,
	"total_pnl" numeric NOT NULL,
	"show_averaging" text DEFAULT 'false' NOT NULL,
	"quick_add" text,
	"show_bulk" text DEFAULT 'false' NOT NULL,
	"bulk_input" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "favorite_intervals" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "account_balance" numeric DEFAULT '10000' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "leverage" text DEFAULT '10' NOT NULL;