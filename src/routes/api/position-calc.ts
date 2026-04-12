import { json } from "@solidjs/router";
import { db, loadPositionCalculator, savePositionCalculator } from "~/lib/db";

export async function GET() {
	try {
		if (!db) {
			return json({ error: "Database unavailable" }, { status: 503 });
		}
		const data = await loadPositionCalculator();
		return json(data);
	} catch (error) {
		console.error("API Error - Failed to load position calculator:", error);
		return json({ error: "Database error" }, { status: 500 });
	}
}

export async function POST(event: { request: Request }) {
	try {
		if (!db) {
			return json({ error: "Database unavailable" }, { status: 503 });
		}

		const data = await event.request.json();
		const success = await savePositionCalculator(data);
		if (success) {
			return json({ success: true });
		} else {
			return json({ error: "Failed to save" }, { status: 500 });
		}
	} catch (error) {
		console.error("API Error - Failed to save position calculator:", error);
		return json({ error: "Internal Server Error" }, { status: 500 });
	}
}
