import { json } from "@solidjs/router";

// ETF Flow data - Demo data with realistic patterns
// NOTE: No free public API exists for Bitcoin ETF flows
// Paid options: Coinglass API, SoSoValue API
// This uses realistic simulated data based on historical patterns

interface ETFFlowDay {
	date: string;
	flow: number; // Positive = inflow, Negative = outflow (millions USD)
	cumulative: number;
}

// Generate realistic ETF flows based on date patterns
function generateRealisticFlows(): ETFFlowDay[] {
	const flows: ETFFlowDay[] = [];
	const today = new Date();
	let cumulative = 35000; // Starting cumulative ~$35B total inflows since launch

	// Generate last 14 days of realistic ETF flow data
	for (let i = 13; i >= 0; i--) {
		const date = new Date(today);
		date.setDate(date.getDate() - i);

		// Skip weekends (ETFs don't trade)
		if (date.getDay() === 0 || date.getDay() === 6) continue;

		// Realistic flow patterns based on market conditions
		// Range: -500M to +800M per day, slight positive bias in bull market
		const dayOfWeek = date.getDay();

		// Monday/Friday tend to have more volatility
		const volatilityMult = dayOfWeek === 1 || dayOfWeek === 5 ? 1.3 : 1.0;

		// Base flow with positive bias
		const baseFlow = 50 + Math.random() * 200; // $50-250M base inflow
		const volatility = (Math.random() - 0.35) * 400 * volatilityMult;
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
			isDemo: true, // Clearly marked as demo - no free API available
			demoNote: "ETF flow data requires paid API (Coinglass/SoSoValue)",
			timestamp: Date.now(),
		});
	} catch (error) {
		console.error("ETF Flow API Error:", error);
		return json({ error: "Failed to fetch ETF flow data" }, { status: 500 });
	}
}
