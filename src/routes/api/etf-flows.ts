import { json } from "@solidjs/router";

// ETF Flow data - Using demo data with realistic patterns
// In production, this would connect to Coinglass or SoSoValue API

interface ETFFlowDay {
	date: string;
	flow: number; // Positive = inflow, Negative = outflow
	cumulative: number;
}

function generateRealisticFlows(): ETFFlowDay[] {
	const flows: ETFFlowDay[] = [];
	const today = new Date();
	let cumulative = 0;

	// Generate last 14 days of realistic ETF flow data
	for (let i = 13; i >= 0; i--) {
		const date = new Date(today);
		date.setDate(date.getDate() - i);

		// Skip weekends
		if (date.getDay() === 0 || date.getDay() === 6) continue;

		// Realistic flow patterns: mostly positive with occasional outflows
		// Range: -500M to +800M per day
		const baseFlow = Math.random() * 400 - 100; // Slight positive bias
		const volatility = (Math.random() - 0.3) * 300;
		const flow = Math.round(baseFlow + volatility);

		cumulative += flow;

		flows.push({
			date: date.toISOString().split("T")[0],
			flow,
			cumulative,
		});
	}

	return flows;
}

export async function GET() {
	try {
		const flows = generateRealisticFlows();
		const last7Days = flows.slice(-7);

		// Calculate metrics
		const todayFlow = flows[flows.length - 1]?.flow || 0;
		const weeklyFlow = last7Days.reduce((sum, d) => sum + d.flow, 0);
		const avgDailyFlow = weeklyFlow / last7Days.length;

		// Determine signal
		let signal: "Bullish" | "Bearish" | "Neutral" = "Neutral";
		let signalLabel = "Mixed";

		if (weeklyFlow > 500) {
			signal = "Bullish";
			signalLabel = "Strong Inflows";
		} else if (weeklyFlow > 0) {
			signal = "Bullish";
			signalLabel = "Net Inflows";
		} else if (weeklyFlow < -500) {
			signal = "Bearish";
			signalLabel = "Strong Outflows";
		} else if (weeklyFlow < 0) {
			signal = "Bearish";
			signalLabel = "Net Outflows";
		}

		return json({
			flows: last7Days,
			todayFlow,
			weeklyFlow,
			avgDailyFlow: Math.round(avgDailyFlow),
			totalFlow: flows[flows.length - 1]?.cumulative || 0,
			signal,
			signalLabel,
			isDemo: true, // Flag to show this is demo data
			timestamp: Date.now(),
		});
	} catch (error) {
		console.error("ETF Flow API Error:", error);
		return json({ error: "Failed to fetch ETF flow data" }, { status: 500 });
	}
}
