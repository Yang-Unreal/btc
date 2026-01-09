import { json } from "@solidjs/router";
import { eq } from "drizzle-orm";
import { db } from "../../lib/db";
import { userSettings } from "../../lib/db/schema";

export async function GET() {
	try {
		// For single user, get settings with id 'default'
		let settings = await db
			.select()
			.from(userSettings)
			.where(eq(userSettings.id, "default"));
		if (settings.length === 0) {
			// Create default settings
			await db.insert(userSettings).values({ id: "default", currency: "USD" });
			settings = await db
				.select()
				.from(userSettings)
				.where(eq(userSettings.id, "default"));
		}
		return json({ currency: settings[0].currency });
	} catch (e) {
		console.error(e);
		return json({ error: "Failed to fetch settings" }, { status: 500 });
	}
}

export async function POST({ request }: { request: Request }) {
	try {
		const body = await request.json();
		const { currency } = body;

		if (!currency || !["USD", "EUR"].includes(currency)) {
			return json({ error: "Invalid currency" }, { status: 400 });
		}

		// Update or insert
		await db
			.insert(userSettings)
			.values({ id: "default", currency, updatedAt: new Date() })
			.onConflictDoUpdate({
				target: userSettings.id,
				set: { currency, updatedAt: new Date() },
			});

		return json({ success: true });
	} catch (e) {
		console.error(e);
		return json({ error: "Failed to update settings" }, { status: 500 });
	}
}
