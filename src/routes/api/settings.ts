import { json } from "@solidjs/router";
import { eq } from "drizzle-orm";
import { db } from "../../lib/db";
import { type NewUserSettings, userSettings } from "../../lib/db/schema";

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
		return json({
			currency: settings[0].currency,
			notificationsEnabled: settings[0].notificationsEnabled === "true",
			fourHAlertEnabled: settings[0].fourHAlertEnabled === "true",
			indicators: settings[0].indicators
				? JSON.parse(settings[0].indicators)
				: null,
		});
	} catch (e) {
		console.error(e);
		return json({ error: "Failed to fetch settings" }, { status: 500 });
	}
}

export async function POST({ request }: { request: Request }) {
	try {
		const body = await request.json();
		const { currency, indicators, notificationsEnabled, fourHAlertEnabled } =
			body;

		const updateData: Partial<NewUserSettings> = { updatedAt: new Date() };
		if (currency && ["USD", "EUR"].includes(currency)) {
			updateData.currency = currency;
		}
		if (indicators) {
			updateData.indicators = JSON.stringify(indicators);
		}
		if (typeof notificationsEnabled === "boolean") {
			updateData.notificationsEnabled = notificationsEnabled ? "true" : "false";
		}
		if (typeof fourHAlertEnabled === "boolean") {
			updateData.fourHAlertEnabled = fourHAlertEnabled ? "true" : "false";
		}

		if (Object.keys(updateData).length <= 1) {
			return json({ error: "No valid data to update" }, { status: 400 });
		}

		// Update or insert
		await db
			.insert(userSettings)
			.values({ id: "default", ...updateData })
			.onConflictDoUpdate({
				target: userSettings.id,
				set: updateData,
			});

		return json({ success: true });
	} catch (e) {
		console.error(e);
		return json({ error: "Failed to update settings" }, { status: 500 });
	}
}
