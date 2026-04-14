import("dotenv")
	.then((m) => m.config())
	.then(async () => {
		const HL_API = "https://api.hyperliquid.xyz/info";

		// Test candleSnapshot - it returns the most recent (in-progress) candle
		const res = await fetch(HL_API, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "candleSnapshot",
				req: {
					coin: "BTC",
					interval: "1m",
					startTime: Date.now() - 60000,
					endTime: Date.now(),
				},
			}),
		});
		const data = await res.json();
		console.log("=== candleSnapshot (last 1m) ===");
		console.log("Latest candle:", data[data.length - 1]);
		console.log("Current price (last close):", data[data.length - 1]?.[4]);
	});
