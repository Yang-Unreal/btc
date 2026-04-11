import { json } from "@solidjs/router";
import { eq } from "drizzle-orm";
import { db } from "../../lib/db";
import { type NewUserSettings, userSettings } from "../../lib/db/schema";

export async function GET() {
	try {
		let settings = await db
			.select()
			.from(userSettings)
			.where(eq(userSettings.id, "default"));
		if (settings.length === 0) {
			await db
				.insert(userSettings)
				.values({ id: "default", currency: "USD", interval: "4h" });
			settings = await db
				.select()
				.from(userSettings)
				.where(eq(userSettings.id, "default"));
		}
		return json({
			currency: settings[0].currency,
			interval: settings[0].interval,
			favoriteIntervals: settings[0].favoriteIntervals
				? JSON.parse(settings[0].favoriteIntervals)
				: ["4h"],
			notificationsEnabled: settings[0].notificationsEnabled === "true",
			fourHAlertEnabled: settings[0].fourHAlertEnabled === "true",
			vipSniper1hAlertEnabled: settings[0].vipSniper1hAlertEnabled === "true",
			indicators: settings[0].indicators
				? JSON.parse(settings[0].indicators)
				: null,
			indicatorHeights: settings[0].indicatorHeights
				? JSON.parse(settings[0].indicatorHeights)
				: null,
			accountBalance: settings[0].accountBalance || "10000",
			leverage: settings[0].leverage || "10",
		});
	} catch (e) {
		console.error(e);
		return json({ error: "Failed to fetch settings" }, { status: 500 });
	}
}

export async function POST({ request }: { request: Request }) {
	try {
		const body = await request.json();
		const {
			currency,
			interval,
			favoriteIntervals,
			indicators,
			indicatorHeights,
			notificationsEnabled,
			fourHAlertEnabled,
			vipSniper1hAlertEnabled,
			accountBalance,
			leverage,
		} = body;

		const updateData: Partial<NewUserSettings> = { updatedAt: new Date() };
		if (currency && ["USD", "EUR"].includes(currency)) {
			updateData.currency = currency;
		}
		if (
			interval &&
			["1m", "5m", "15m", "30m", "1h", "4h", "12h", "1d", "1w"].includes(
				interval,
			)
		) {
			updateData.interval = interval;
		}
		if (favoriteIntervals && Array.isArray(favoriteIntervals)) {
			updateData.favoriteIntervals = JSON.stringify(favoriteIntervals);
		}
		if (indicators) {
			updateData.indicators = JSON.stringify(indicators);
		}
		if (indicatorHeights) {
			updateData.indicatorHeights = JSON.stringify(indicatorHeights);
		}
		if (typeof notificationsEnabled === "boolean") {
			updateData.notificationsEnabled = notificationsEnabled ? "true" : "false";
		}
		if (typeof fourHAlertEnabled === "boolean") {
			updateData.fourHAlertEnabled = fourHAlertEnabled ? "true" : "false";
		}
		if (typeof vipSniper1hAlertEnabled === "boolean") {
			updateData.vipSniper1hAlertEnabled = vipSniper1hAlertEnabled
				? "true"
				: "false";
		}
		if (accountBalance && !isNaN(Number(accountBalance))) {
			updateData.accountBalance = String(accountBalance);
		}
		if (leverage && !isNaN(Number(leverage))) {
			updateData.leverage = String(leverage);
		}

		if (Object.keys(updateData).length <= 1) {
			return json({ error: "No valid data to update" }, { status: 400 });
		}

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
