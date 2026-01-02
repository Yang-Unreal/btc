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
		<div class="h-full flex flex-col">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-6 border-l-4 border-indigo-500 pl-6 py-1">
				<div class="min-w-0">
					<h2 class="text-2xl font-black text-white tracking-tighter uppercase leading-tight">
						Execution Checklist
					</h2>
					<p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
						Operational_Pre-Flight_Sequence
					</p>
				</div>
				<div class="shrink-0">
					<div class="flex items-baseline gap-2 mb-1">
						<span class="text-3xl font-mono font-black text-indigo-400">
							{Math.round(progress())}
						</span>
						<span class="text-xs font-bold text-slate-600 uppercase">%</span>
					</div>
					<div class="w-24 sm:w-32 h-1 bg-white/5 overflow-hidden">
						<div
							class="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-700 ease-out"
							style={{ width: `${progress()}%` }}
						></div>
					</div>
				</div>
			</div>

			<div class="grow space-y-8">
				{(["Macro", "Technical", "Derivatives", "Risk"] as const).map((cat) => (
					<div>
						<div class="flex items-center gap-3 mb-4">
							<span class="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">
								{cat}_Parameters
							</span>
							<div class="h-px grow bg-white/5"></div>
						</div>
						<div class="grid grid-cols-1 gap-1">
							<For each={items().filter((i) => i.category === cat)}>
								{(item) => (
									<button
										type="button"
										onClick={() => toggleItem(item.id)}
										class={`w-full flex items-center gap-4 px-4 py-3 border transition-all duration-200 group ${
											item.checked
												? "bg-indigo-500/5 border-indigo-500/20 text-indigo-100"
												: "bg-white/2 border-white/5 text-slate-500 hover:border-white/10 hover:bg-white/4"
										}`}
									>
										<div
											class={`w-4 h-4 flex items-center justify-center border transition-all ${
												item.checked
													? "bg-indigo-500 border-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]"
													: "border-white/10 group-hover:border-white/30"
											}`}
										>
											{item.checked && (
												<svg
													class="w-2.5 h-2.5 text-white"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<title>Checkmark Icon</title>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="4"
														d="M5 13l4 4L19 7"
													/>
												</svg>
											)}
										</div>
										<span class="text-[11px] font-bold uppercase tracking-tight text-left">
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
				class={`w-full mt-10 py-5 font-black uppercase tracking-[0.3em] transition-all duration-300 text-xs border ${
					allChecked()
						? "bg-indigo-600 border-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:bg-indigo-500"
						: "bg-white/5 border-white/10 text-slate-700 cursor-not-allowed"
				}`}
			>
				{allChecked()
					? "Confirm Execution Sequence"
					: "Awaiting Operational Clearance"}
			</button>
		</div>
	);
}
