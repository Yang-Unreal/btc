import { createMemo, createSignal, For, Show } from "solid-js";
import { formatCryptoPrice } from "../lib/format";
import { globalStore } from "../lib/store";

interface Holding {
	amount: number;
	totalCost: number;
	averageBuyPrice: number;
	realizedPnL: number;
}

interface AllocationChartProps {
	holdings: Record<string, Holding>;
	prices: Record<string, number>;
}

const COLORS = [
	"#3b82f6", // blue-500
	"#8b5cf6", // violet-500
	"#10b981", // emerald-500
	"#f59e0b", // amber-500
	"#ef4444", // red-500
	"#ec4899", // pink-500
	"#06b6d4", // cyan-500
	"#84cc16", // lime-500
];

export default function AllocationChart(props: AllocationChartProps) {
	const [hoveredSlice, setHoveredSlice] = createSignal<{
		label: string;
		value: number;
		subLabel?: string;
	} | null>(null);

	const allocations = createMemo(() => {
		const h = props.holdings;
		const p = props.prices;
		let total = 0;
		const values: { ticker: string; value: number; percentage: number }[] = [];

		Object.entries(h).forEach(([ticker, holding]) => {
			const price = p[ticker] || 0;
			const value = holding.amount * price;
			if (value > 0) {
				total += value;
				values.push({ ticker, value, percentage: 0 });
			}
		});

		values.sort((a, b) => b.value - a.value);
		values.forEach((v) => {
			v.percentage = total > 0 ? (v.value / total) * 100 : 0;
		});

		return { values, total };
	});

	const pieData = createMemo(() => {
		const { values } = allocations();
		let cumulative = 0;
		const gap = values.length > 1 ? 2 : 0;

		return values.map((v, i) => {
			const valueDegrees = (v.percentage / 100) * 360;
			// Ensure we don't cross into negative angles if gap is too large for small slices
			const actualDegree = Math.max(valueDegrees, gap + 0.1);
			const startAngle = cumulative;
			const endAngle = cumulative + actualDegree - gap;
			cumulative += actualDegree;

			return {
				...v,
				startAngle,
				endAngle,
				color: COLORS[i % COLORS.length],
			};
		});
	});

	// SVG Math
	const describeArc = (
		x: number,
		y: number,
		radius: number,
		innerRadius: number,
		startAngle: number,
		endAngle: number,
	) => {
		// Fix for 360-degree arcs:
		// If the arc is a full circle (or close to it), SVG arc command fails because start == end.
		// We clamp the max angle difference to 359.99 degrees to ensure it renders a "full" circle.
		if (endAngle - startAngle >= 360) {
			endAngle = startAngle + 359.99;
		}

		const start = polarToCartesian(x, y, radius, endAngle);
		const end = polarToCartesian(x, y, radius, startAngle);
		const startInner = polarToCartesian(x, y, innerRadius, endAngle);
		const endInner = polarToCartesian(x, y, innerRadius, startAngle);

		const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

		return [
			"M",
			start.x,
			start.y,
			"A",
			radius,
			radius,
			0,
			largeArcFlag,
			0,
			end.x,
			end.y,
			"L",
			endInner.x,
			endInner.y,
			"A",
			innerRadius,
			innerRadius,
			0,
			largeArcFlag,
			1,
			startInner.x,
			startInner.y,
			"Z",
		].join(" ");
	};

	const polarToCartesian = (
		centerX: number,
		centerY: number,
		radius: number,
		angleInDegrees: number,
	) => {
		const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
		return {
			x: centerX + radius * Math.cos(angleInRadians),
			y: centerY + radius * Math.sin(angleInRadians),
		};
	};

	return (
		<div class="flex flex-col md:flex-row items-center justify-center gap-8 w-full p-4">
			{/* Chart Side */}
			<div class="relative shrink-0 w-56 h-56">
				<svg
					viewBox="0 0 200 200"
					class="w-full h-full drop-shadow-xl overflow-visible"
					role="img"
					aria-label="Portfolio allocation chart"
				>
					<For each={pieData()}>
						{(slice) => (
							<path
								d={describeArc(
									100,
									100,
									100,
									80,
									slice.startAngle,
									slice.endAngle,
								)}
								fill={slice.color}
								class="transition-all duration-200 hover:opacity-90 cursor-pointer origin-center hover:scale-105"
								role="button"
								tabIndex={0}
								onMouseEnter={() =>
									setHoveredSlice({
										label: slice.ticker,
										value: slice.value,
										subLabel: `${slice.percentage.toFixed(1)}%`,
									})
								}
								onMouseLeave={() => setHoveredSlice(null)}
								onFocus={() =>
									setHoveredSlice({
										label: slice.ticker,
										value: slice.value,
										subLabel: `${slice.percentage.toFixed(1)}%`,
									})
								}
								onBlur={() => setHoveredSlice(null)}
							/>
						)}
					</For>
					{/* Fallback for empty state */}
					<Show when={pieData().length === 0}>
						<circle
							cx="100"
							cy="100"
							r="90"
							class="stroke-white/10 fill-transparent"
							stroke-width="2"
							stroke-dasharray="6 6"
						/>
					</Show>
				</svg>

				{/* Center Text Info */}
				<div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
					<Show
						when={hoveredSlice()}
						fallback={
							<>
								<span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
									Net Worth
								</span>
								<span class="font-bold text-slate-200 text-lg font-mono">
									{allocations().total > 0
										? formatCryptoPrice(
												allocations().total,
												globalStore.currency(),
											)
										: "$0.00"}
								</span>
							</>
						}
					>
						{(hovered) => (
							<>
								<span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
									{hovered().label}
								</span>
								<span class="font-bold text-white text-lg font-mono">
									{formatCryptoPrice(hovered().value, globalStore.currency())}
								</span>
								<span class="text-xs text-indigo-400 font-mono font-bold">
									{hovered().subLabel}
								</span>
							</>
						)}
					</Show>
				</div>
			</div>

			{/* Legend Side */}
			<div class="flex-1 w-full min-w-[200px] overflow-y-auto max-h-[240px] pr-2 custom-scrollbar">
				<div class="space-y-3">
					<For each={pieData()}>
						{(slice) => (
							<div
								class="flex items-center justify-between group p-2 rounded-lg hover:bg-white/5 transition-colors"
								role="button"
								tabIndex={0}
								onMouseEnter={() =>
									setHoveredSlice({
										label: slice.ticker,
										value: slice.value,
										subLabel: `${slice.percentage.toFixed(1)}%`,
									})
								}
								onMouseLeave={() => setHoveredSlice(null)}
								onFocus={() =>
									setHoveredSlice({
										label: slice.ticker,
										value: slice.value,
										subLabel: `${slice.percentage.toFixed(1)}%`,
									})
								}
								onBlur={() => setHoveredSlice(null)}
							>
								<div class="flex items-center gap-3">
									<div
										class="w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]"
										style={{ "background-color": slice.color }}
									/>
									<span class="font-bold text-sm text-slate-300 group-hover:text-white transition-colors">
										{slice.ticker}
									</span>
								</div>
								<div class="text-right">
									<div class="font-mono text-xs font-bold text-indigo-300">
										{slice.percentage.toFixed(1)}%
									</div>
									<div class="font-mono text-[10px] text-slate-500">
										{formatCryptoPrice(slice.value, globalStore.currency())}
									</div>
								</div>
							</div>
						)}
					</For>
					<Show when={pieData().length === 0}>
						<div class="text-sm text-slate-500 text-center py-8 italic border border-dashed border-white/10 rounded-xl">
							No assets or price data available.
							<br />
							<span class="text-xs opacity-70">
								Add a transaction to see allocation.
							</span>
						</div>
					</Show>
				</div>
			</div>
		</div>
	);
}
