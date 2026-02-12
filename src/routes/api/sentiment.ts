import { json } from "@solidjs/router";
import { apiCache } from "~/lib/cache";

interface FearGreedData {
	value: string;
	value_classification: string;
	timestamp: string;
	time_until_update: string;
}

interface AlternativeMeResponse {
	name: string;
	data: FearGreedData[];
	metadata: {
		error: null | string;
	};
}

export async function GET() {
	const cacheKey = "sentiment_fng";
	const cachedData = apiCache.get(cacheKey);

	if (cachedData) {
		return json(cachedData);
	}

	try {
		const response = await fetch("https://api.alternative.me/fng/?limit=1");
		if (!response.ok) {
			throw new Error(`API Error: ${response.status}`);
		}

		const data: AlternativeMeResponse = await response.json();

		if (data.data && data.data.length > 0) {
			const result = data.data[0];
			// Cache for 1 hour (3600 * 1000 ms) as it updates daily/hourly
			apiCache.set(cacheKey, result, 3600 * 1000);
			return json(result);
		}

		return json({ error: "No data found" }, { status: 404 });
	} catch (error) {
		console.error("Sentiment API Error:", error);
		return json({ error: "Internal Server Error" }, { status: 500 });
	}
}
