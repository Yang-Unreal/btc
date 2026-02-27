import { json } from "@solidjs/router";
import { desc, eq } from "drizzle-orm";
import { db } from "../../lib/db";
import { priceAlerts } from "../../lib/db/schema";

export async function GET() {
	try {
		const alerts = await db
			.select()
			.from(priceAlerts)
			.orderBy(desc(priceAlerts.createdAt));

		return json(alerts);
	} catch (e) {
		console.error(e);
		return json({ error: "Failed to fetch alerts" }, { status: 500 });
	}
}

export async function POST({ request }: { request: Request }) {
	try {
		const body = await request.json();
		const { type, id, symbol, targetPrice, enabled } = body;

		if (type === "DELETE") {
			if (!id) return json({ error: "ID required" }, { status: 400 });
			await db.delete(priceAlerts).where(eq(priceAlerts.id, id));
			return json({ success: true });
		}

		if (type === "TOGGLE") {
			if (!id) return json({ error: "ID required" }, { status: 400 });
			await db
				.update(priceAlerts)
				.set({ enabled: enabled ? "true" : "false", updatedAt: new Date() })
				.where(eq(priceAlerts.id, id));
			return json({ success: true });
		}

		// Add new alert
		if (!targetPrice)
			return json({ error: "Target price required" }, { status: 400 });

		await db.insert(priceAlerts).values({
			symbol: symbol || "BTC",
			targetPrice: String(targetPrice),
			enabled: "true",
			triggered: "false",
		});

		return json({ success: true });
	} catch (e) {
		console.error(e);
		return json({ error: "Failed to process alert" }, { status: 500 });
	}
}
