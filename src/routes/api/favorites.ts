import { json } from "@solidjs/router";
import { eq } from "drizzle-orm";
import { db } from "~/lib/db";
import { favorites } from "~/lib/db/schema";

export async function GET() {
	try {
		if (!db) {
			return json({ error: "Database unavailable" }, { status: 503 });
		}
		const rows = await db.select().from(favorites);
		const symbols = rows.map((r) => r.symbol);
		return json({ favorites: symbols });
	} catch (e) {
		console.error("Failed to load favorites:", e);
		return json({ error: "Database error" }, { status: 500 });
	}
}

export async function POST(event: { request: Request }) {
	try {
		if (!db) {
			return json({ error: "Database unavailable" }, { status: 503 });
		}

		const body = await event.request.json();
		const { symbols } = body as { symbols?: string[] };

		if (!Array.isArray(symbols)) {
			return json({ error: "Invalid payload" }, { status: 400 });
		}

		await db.delete(favorites);

		if (symbols.length > 0) {
			await db.insert(favorites).values(
				symbols.map((symbol) => ({ symbol })),
			);
		}

		return json({ success: true });
	} catch (e) {
		console.error("Failed to save favorites:", e);
		return json({ error: "Database error" }, { status: 500 });
	}
}
