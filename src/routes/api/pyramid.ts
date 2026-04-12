import { json } from "@solidjs/router";
import { db, loadPyramidPositions, savePyramidPositions } from "~/lib/db";

export async function GET() {
	try {
		if (!db) {
			return json({ error: "Database unavailable" }, { status: 503 });
		}
		const data = await loadPyramidPositions();
		return json(data);
	} catch (error) {
		console.error("API Error - Failed to load pyramid positions:", error);
		return json({ error: "Database error" }, { status: 500 });
	}
}

export async function POST(event: { request: Request }) {
	try {
		if (!db) {
			return json({ error: "Database unavailable" }, { status: 503 });
		}

		const data = await event.request.json();
		const success = await savePyramidPositions(data);
		if (success) {
			return json({ success: true });
		} else {
			return json({ error: "Failed to save" }, { status: 500 });
		}
	} catch (error) {
		console.error("API Error - Failed to save pyramid positions:", error);
		return json({ error: "Internal Server Error" }, { status: 500 });
	}
}
