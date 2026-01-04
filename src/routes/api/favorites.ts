import { json } from "@solidjs/router";
import { eq } from "drizzle-orm";
import { db } from "~/lib/db";
import { favorites } from "~/lib/db/schema";

export async function GET() {
	try {
		console.log("API: Fetching favorites...");
		if (!db) {
			console.error("API Error: Database connection not initialized");
			return json({ error: "Database unavailable" }, { status: 503 });
		}
		const allFavorites = await db.select().from(favorites);
		console.log("API: Favorites fetched:", allFavorites.length);
		return json(allFavorites.map((f: { symbol: string }) => f.symbol));
	} catch (error) {
		console.error("API Error - Failed to fetch favorites:", error);
		return json({ error: "Database error" }, { status: 500 });
	}
}

export async function POST(event: { request: Request }) {
	try {
		if (!db) {
			return json({ error: "Database unavailable" }, { status: 503 });
		}

		const { symbol } = await event.request.json();
		if (!symbol) {
			return json({ error: "Symbol is required" }, { status: 400 });
		}

		// Check if it exists
		const existing = await db
			.select()
			.from(favorites)
			.where(eq(favorites.symbol, symbol))
			.limit(1);

		if (existing.length > 0) {
			// Remove it
			await db.delete(favorites).where(eq(favorites.symbol, symbol));
			return json({ favorited: false });
		} else {
			// Add it
			await db.insert(favorites).values({ symbol });
			return json({ favorited: true });
		}
	} catch (error) {
		console.error("API Error - Failed to toggle favorite:", error);
		return json({ error: "Internal Server Error" }, { status: 500 });
	}
}
