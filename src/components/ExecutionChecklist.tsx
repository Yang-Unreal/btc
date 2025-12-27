import { createSignal, For } from "solid-js";

interface ChecklistItem {
	id: string;
	label: string;
	category: "Macro" | "Technical" | "Derivatives" | "Risk";
	checked: boolean;
}

const INITIAL_ITEMS: ChecklistItem[] = [
	{
		id: "macro-1",
		label: "DXY Trending Down (USD Weakening)",
		category: "Macro",
		checked: false,
	},
	{
		id: "macro-2",
		label: "US10Y Yield Stable/Descending",
		category: "Macro",
		checked: false,
	},
	{
		id: "tech-1",
		label: "Price > EMA 200 (Long Term Bias)",
		category: "Technical",
		checked: false,
	},
	{
		id: "tech-2",
		label: "EMA 20/60 Bullish Alignment",
		category: "Technical",
		checked: false,
	},
	{
		id: "tech-3",
		label: "No Bearish RSI Divergence",
		category: "Technical",
		checked: false,
	},
	{
		id: "deriv-1",
		label: "Funding Rates Neutral or Reset",
		category: "Derivatives",
		checked: false,
	},
	{
		id: "deriv-2",
		label: "Open Interest Growing with Price",
		category: "Derivatives",
		checked: false,
	},
	{
		id: "risk-1",
		label: "Position Size Calculated",
		category: "Risk",
		checked: false,
	},
	{
		id: "risk-2",
		label: "Stop Loss Order Ready",
		category: "Risk",
		checked: false,
	},
];

export default function ExecutionChecklist() {
	const [items, setItems] = createSignal<ChecklistItem[]>(INITIAL_ITEMS);

	const toggleItem = (id: string) => {
		setItems((prev) =>
			prev.map((item) =>
				item.id === id ? { ...item, checked: !item.checked } : item,
			),
		);
	};

	const progress = () => {
		const checkedCount = items().filter((i) => i.checked).length;
		return (checkedCount / items().length) * 100;
	};

	const allChecked = () => items().every((i) => i.checked);

	return (
		<div class="p-6 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 text-white">
			<div class="flex items-center justify-between mb-8">
				<div>
					<h2 class="text-xl font-bold tracking-tight">Execution Checklist</h2>
					<p class="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">
						Final Validation Before Allocation
					</p>
				</div>
				<div class="text-right">
					<span class="text-2xl font-mono font-black text-indigo-400">
						{Math.round(progress())}%
					</span>
					<div class="w-32 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
						<div
							class="h-full bg-indigo-500 transition-all duration-500 ease-out"
							style={{ width: `${progress()}%` }}
						></div>
					</div>
				</div>
			</div>

			<div class="space-y-6">
				{(["Macro", "Technical", "Derivatives", "Risk"] as const).map((cat) => (
					<div>
						<h3 class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 border-b border-slate-800 pb-1">
							{cat} Filters
						</h3>
						<div class="space-y-2">
							<For each={items().filter((i) => i.category === cat)}>
								{(item) => (
									<button
										type="button"
										onClick={() => toggleItem(item.id)}
										class={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 border ${
											item.checked
												? "bg-indigo-500/10 border-indigo-500/30 text-indigo-100"
												: "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600"
										}`}
									>
										<div
											class={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
												item.checked
													? "bg-indigo-500 border-indigo-500"
													: "border-slate-600"
											}`}
										>
											{item.checked && (
												<svg
													class="w-3 h-3 text-white"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<title>Checkmark Icon</title>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="3"
														d="M5 13l4 4L19 7"
													/>
												</svg>
											)}
										</div>
										<span class="text-xs font-bold text-left leading-tight">
											{item.label}
										</span>
									</button>
								)}
							</For>
						</div>
					</div>
				))}
			</div>

			<button
				type="button"
				disabled={!allChecked()}
				onClick={() => alert("Strategic Allocation Initialized.")}
				class={`w-full mt-8 py-4 rounded-xl font-black uppercase tracking-widest transition-all duration-300 text-sm ${
					allChecked()
						? "bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 text-white"
						: "bg-slate-800 text-slate-600 cursor-not-allowed opacity-50"
				}`}
			>
				{allChecked() ? "Confirm Allocation" : "Filters Incomplete"}
			</button>
		</div>
	);
}
