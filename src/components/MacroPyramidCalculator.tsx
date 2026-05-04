import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { createStore, reconcile } from "solid-js/store";

interface PositionEntry {
	id: number;
	price: number;
	size: number;
}

export default function MacroPyramidCalculator() {
	const [entries, setEntries] = createStore<PositionEntry[]>([
		{ id: 1, price: 69600, size: 0.04 },
		{ id: 2, price: 70100, size: 0.04 },
		{ id: 3, price: 70600, size: 0.04 },
	]);

	const [currentPrice, setCurrentPrice] = createSignal(70100);
	const [stopLoss, setStopLoss] = createSignal(71000);
	const [isShort, setIsShort] = createSignal(true);
	const [showBulk, setShowBulk] = createSignal(false);
	const [bulkInput, setBulkInput] = createSignal("");
	const [isOpen, setIsOpen] = createSignal(false);
	const [isLoaded, setIsLoaded] = createSignal(false);
	const [showAveraging, setShowAveraging] = createSignal(false);
	const [quickAdd, setQuickAdd] = createStore({
		price: 0,
		size: 0,
	});

	const saveToDb = async () => {
		if (!isLoaded()) return;
		try {
			await fetch("/api/pyramid", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					entries: entries.map((e) => ({ price: e.price, size: e.size })),
					currentPrice: currentPrice(),
					stopLoss: stopLoss(),
					isShort: isShort(),
					totalSize: totalSize(),
					avgPrice: avgPrice(),
					totalPnl: totalPnL(),
					showAveraging: showAveraging(),
					quickAdd: { price: quickAdd.price, size: quickAdd.size },
					showBulk: showBulk(),
					bulkInput: bulkInput(),
				}),
			});
		} catch (e) {
			console.error("Failed to save pyramid positions:", e);
		}
	};

	let saveTimeout: any;
	const debouncedSave = () => {
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(saveToDb, 500);
	};

	onMount(async () => {
		try {
			const res = await fetch("/api/pyramid");
			if (res.ok) {
				const data = await res.json();
				if (data?.entries && data.entries.length > 0) {
					const loadedEntries = data.entries.map(
						(e: { price: number; size: number }, idx: number) => ({
							id: idx + 1,
							price: e.price,
							size: e.size,
						}),
					);
					setEntries(reconcile(loadedEntries));
					setCurrentPrice(data.currentPrice);
					setStopLoss(data.stopLoss);
					setIsShort(data.isShort);
					setShowAveraging(data.showAveraging || false);
					if (data.quickAdd) setQuickAdd(data.quickAdd);
					setShowBulk(data.showBulk || false);
					setBulkInput(data.bulkInput || "");
				}
			}
		} catch (e) {
			console.error("Failed to load pyramid positions:", e);
		}
		setIsLoaded(true);
	});

	const totalSize = createMemo(() =>
		entries.reduce((sum, e) => sum + e.size, 0),
	);

	const avgPrice = createMemo(() => {
		const size = totalSize();
		if (size === 0) return 0;
		const totalValue = entries.reduce((sum, e) => sum + e.price * e.size, 0);
		return totalValue / size;
	});

	const totalPnL = createMemo(() => {
		return entries.reduce((sum, e) => {
			const diff = isShort()
				? e.price - currentPrice()
				: currentPrice() - e.price;
			return sum + diff * e.size;
		}, 0);
	});

	const pnlAtSL = createMemo(() => {
		return entries.reduce((sum, e) => {
			const diff = isShort() ? e.price - stopLoss() : stopLoss() - e.price;
			return sum + diff * e.size;
		}, 0);
	});

	const maxRisk = createMemo(() => Math.max(0, -pnlAtSL()));
	const lockedProfit = createMemo(() => Math.max(0, pnlAtSL()));

	const addEntry = () => {
		const newId =
			entries.length > 0 ? Math.max(...entries.map((e) => e.id)) + 1 : 1;
		const lastEntry = entries[entries.length - 1];
		setEntries(entries.length, {
			id: newId,
			price: lastEntry ? lastEntry.price + 500 : 70000,
			size: 0.04,
		});
		debouncedSave();
	};

	const removeEntry = (id: number) => {
		setEntries(entries.filter((e) => e.id !== id));
		debouncedSave();
	};

	const updateEntry = (id: number, field: "price" | "size", value: number) => {
		const index = entries.findIndex((e) => e.id === id);
		if (index !== -1) {
			setEntries(index, field, value);
		}
		debouncedSave();
	};

	const handleBulkInput = (val: string) => {
		setBulkInput(val);
		const lines = val.split("\n").filter((l) => l.trim());
		const newEntries = lines.map((line, idx) => {
			const parts = line.split(/[\s,;]+/).filter((p) => p);
			return {
				id: Date.now() + idx,
				price: parseFloat(parts[0]) || 0,
				size: parseFloat(parts[1]) || 0.04,
			};
		});
		if (newEntries.length > 0) {
			setEntries(reconcile(newEntries));
		}
		debouncedSave();
	};

	const generatePyramid = (
		start: number,
		interval: number,
		count: number,
		sizePerStep: number,
	) => {
		const newEntries = Array.from({ length: count }, (_, i) => ({
			id: Date.now() + i,
			// For short, scale up. For long, scale down (or follow isShort signal)
			price: isShort() ? start + i * interval : start - i * interval,
			size: sizePerStep,
		}));
		setEntries(reconcile(newEntries));
		setShowBulk(false);
		debouncedSave();
	};

	const commitQuickAdd = () => {
		if (quickAdd.price <= 0 || quickAdd.size <= 0) return;
		const newId =
			entries.length > 0 ? Math.max(...entries.map((e) => e.id)) + 1 : 1;
		setEntries(entries.length, {
			id: newId,
			price: quickAdd.price,
			size: quickAdd.size,
		});
		setQuickAdd({ price: 0, size: 0 });
		setShowAveraging(false);
		debouncedSave();
	};

	const newAvgAfterAdd = createMemo(() => {
		const currentVal = entries.reduce((sum, e) => sum + e.price * e.size, 0);
		const addedVal = quickAdd.price * quickAdd.size;
		const newSize = totalSize() + quickAdd.size;
		return newSize > 0 ? (currentVal + addedVal) / newSize : 0;
	});

	return (
		<>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen())}
				class="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-60 w-12 h-12 bg-indigo-600 rounded-full shadow-2xl flex items-center justify-center text-white hover:bg-indigo-500 transition-transform hover:scale-105 active:scale-95"
			>
				<Show
					when={isOpen()}
					fallback={
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<title>Open Calculator</title>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
							/>
						</svg>
					}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<title>Close Calculator</title>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</Show>
			</button>

			<Show when={isOpen()}>
				<div class="fixed bottom-20 right-4 sm:bottom-24 sm:right-8 w-[calc(100vw-2rem)] sm:w-96 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col max-h-[75vh] sm:max-h-[80vh]">
					{/* Header */}
					<div class="p-4 border-b border-white/5 bg-linear-to-r from-indigo-500/10 to-transparent flex items-center justify-between">
						<div>
							<h3 class="text-sm font-bold text-white tracking-widest uppercase flex items-center gap-2">
								<span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
								Pyramid Scale V4.5
							</h3>
							<p class="text-[10px] text-zinc-400 font-mono mt-1">
								WHALE HUNTER MACRO ENGINE
							</p>
						</div>
						<button
							type="button"
							onClick={() => {
								setIsShort(!isShort());
								debouncedSave();
							}}
							class={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
								isShort()
									? "border-rose-500/50 bg-rose-500/10 text-rose-400"
									: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
							}`}
						>
							{isShort() ? "SHORT (BEAR)" : "LONG (BULL)"}
						</button>
					</div>

					{/* Stats Summary */}
					<div class="p-6 grid grid-cols-3 gap-2 bg-white/2">
						<div class="space-y-1">
							<p class="text-[9px] text-zinc-500 font-mono text-center uppercase tracking-tighter">
								Current PnL
							</p>
							<p
								class={`text-sm font-bold text-center tabular-nums ${totalPnL() >= 0 ? "text-emerald-400" : "text-rose-400"}`}
							>
								{totalPnL() >= 0 ? "+" : ""}
								{totalPnL().toFixed(2)}U
							</p>
						</div>
						<div class="space-y-1 border-x border-white/5">
							<p class="text-[9px] text-zinc-500 font-mono text-center uppercase tracking-tighter">
								Max Risk
							</p>
							<p
								class={`text-sm font-bold text-center tabular-nums ${maxRisk() > 0 ? "text-rose-500" : "text-zinc-500"}`}
							>
								{maxRisk().toFixed(2)}U
							</p>
						</div>
						<div class="space-y-1">
							<p class="text-[9px] text-zinc-500 font-mono text-center uppercase tracking-tighter">
								Locked Profit
							</p>
							<p
								class={`text-sm font-bold text-center tabular-nums ${lockedProfit() > 0 ? "text-emerald-400" : "text-zinc-500"}`}
							>
								{lockedProfit().toFixed(2)}U
							</p>
						</div>
						<div class="col-span-3 space-y-3 pt-2 border-t border-white/5">
							<div class="space-y-1">
								<div class="flex justify-between text-[10px] font-mono text-zinc-400">
									<span>AVG ENTRY: ${avgPrice().toFixed(0)}</span>
									<span>VOL: {totalSize().toFixed(2)} BTC</span>
								</div>
							</div>

							<div class="space-y-2">
								<div class="flex justify-between items-center text-[10px] font-mono">
									<span class="text-indigo-400 uppercase tracking-tighter">
										Target Stop Loss
									</span>
									<span class="text-rose-400">
										${stopLoss().toLocaleString()}
									</span>
								</div>
								<input
									type="number"
									value={stopLoss()}
									onInput={(e) => {
										setStopLoss(Number(e.currentTarget.value));
										debouncedSave();
									}}
									class="w-full bg-zinc-800/50 border border-rose-500/20 rounded px-3 py-1.5 text-sm text-rose-400 focus:outline-none focus:border-rose-500/50 transition-colors font-mono"
									placeholder="Stop price..."
								/>
							</div>

							<div class="space-y-2 pt-1">
								<div class="flex justify-between text-[10px] font-mono text-zinc-400">
									<span class="uppercase tracking-tighter text-indigo-400/80">
										Simulated Price
									</span>
									<span class="text-indigo-400">
										${currentPrice().toLocaleString()}
									</span>
								</div>
								<div class="grid grid-cols-5 gap-2 items-center">
									<input
										type="number"
										value={currentPrice()}
										onInput={(e) => {
											setCurrentPrice(Number(e.currentTarget.value));
											debouncedSave();
										}}
										class="col-span-2 bg-zinc-800/50 border border-indigo-500/20 rounded px-2 py-1 text-xs text-indigo-400 focus:outline-none focus:border-indigo-500/50 transition-colors font-mono"
									/>
									<input
										type="range"
										min="30000"
										max="150000"
										step="100"
										value={currentPrice()}
										onInput={(e) => {
											setCurrentPrice(Number(e.currentTarget.value));
											debouncedSave();
										}}
										class="col-span-3 accent-indigo-500 bg-zinc-800 rounded-lg appearance-none cursor-pointer h-1.5"
									/>
								</div>
							</div>
						</div>
					</div>

					{/* Position List */}
					<div class="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar border-t border-white/5">
						<div class="flex items-center justify-between px-1 mb-2">
							<span class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
								Entry Blocks
							</span>
							<div class="flex gap-3">
								<button
									type="button"
									onClick={() => {
										setShowAveraging(!showAveraging());
										setShowBulk(false);
										if (quickAdd.price === 0) setQuickAdd("price", currentPrice());
									}}
									class={`text-[10px] font-bold transition-colors uppercase ${showAveraging() ? "text-indigo-400" : "text-zinc-500 hover:text-indigo-400"}`}
								>
									[ Averaging ]
								</button>
								<button
									type="button"
									onClick={() => {
										setShowBulk(!showBulk());
										setShowAveraging(false);
									}}
									class={`text-[10px] font-bold transition-colors uppercase ${showBulk() ? "text-indigo-400" : "text-zinc-500 hover:text-indigo-400"}`}
								>
									[ Bulk Mode ]
								</button>
								<button
									type="button"
									onClick={addEntry}
									class="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase"
								>
									+ Add Step
								</button>
							</div>
						</div>
						
						{showAveraging() && (
							<div class="mb-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
								<div class="p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/20 space-y-4">
									<div class="flex items-center justify-between">
										<span class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Averaging Tool</span>
										<span class="text-[9px] font-mono text-zinc-500 italic">Simulate addition</span>
									</div>
									
									<div class="grid grid-cols-2 gap-4">
										<div class="space-y-1.5">
											<label class="text-[9px] font-mono text-zinc-500 uppercase">Add Price</label>
											<input
												type="number"
												value={quickAdd.price}
												onInput={(e) => setQuickAdd("price", Number(e.currentTarget.value))}
												class="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 font-mono"
											/>
										</div>
										<div class="space-y-1.5">
											<label class="text-[9px] font-mono text-zinc-500 uppercase">Add Size</label>
											<input
												type="number"
												step="0.01"
												value={quickAdd.size}
												onInput={(e) => setQuickAdd("size", Number(e.currentTarget.value))}
												class="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 font-mono"
											/>
										</div>
									</div>

									<div class="pt-2 border-t border-white/5 flex flex-col gap-2">
										<div class="flex justify-between items-center text-[10px] font-mono">
											<span class="text-zinc-400">NEW AVG PRICE:</span>
											<span class="text-indigo-400 font-bold">${newAvgAfterAdd().toFixed(2)}</span>
										</div>
										<div class="flex justify-between items-center text-[10px] font-mono">
											<span class="text-zinc-400">PRICE SHIFT:</span>
											<span class={newAvgAfterAdd() >= avgPrice() ? "text-emerald-400" : "text-rose-400"}>
												{Math.abs(newAvgAfterAdd() - avgPrice()).toFixed(2)}U
											</span>
										</div>
										<button
											type="button"
											onClick={commitQuickAdd}
											class="w-full mt-2 py-2 rounded bg-indigo-600 text-white text-[10px] font-bold uppercase hover:bg-indigo-500 transition-colors shadow-lg active:scale-95"
										>
											Apply to Position
										</button>
									</div>
								</div>
							</div>
						)}

						{showBulk() && (
							<div class="mb-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
								<div class="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/20">
									<label
										for="bulk-input-area"
										class="text-[9px] font-mono text-indigo-400 block mb-2 uppercase tracking-tight"
									>
										Paste: Price, Size (one per line)
									</label>
									<textarea
										id="bulk-input-area"
										value={bulkInput()}
										onInput={(e) => handleBulkInput(e.currentTarget.value)}
										placeholder="69000, 0.04&#10;70000, 0.08&#10;71000, 0.12"
										class="w-full h-32 bg-black/40 border border-white/5 rounded-lg p-2 text-[10px] font-mono text-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none no-scrollbar"
									/>
									<div class="mt-3 flex gap-2">
										<button
											type="button"
											onClick={() =>
												generatePyramid(
													entries[0]?.price || 70000,
													500,
													5,
													0.04,
												)
											}
											class="flex-1 py-1.5 rounded bg-indigo-500/20 text-indigo-400 text-[9px] font-bold uppercase hover:bg-indigo-500/30 transition-colors border border-indigo-500/20"
										>
											Auto 5-Step Scale
										</button>
									</div>
								</div>
							</div>
						)}

						<For each={entries}>
							{(entry) => (
								<div class="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all group">
									<div class="flex items-center gap-3">
										<div class="flex-1 space-y-3">
											<div class="flex items-center gap-2">
												<span class="text-[10px] font-mono text-zinc-500">
													PX:
												</span>
												<input
													type="number"
													value={entry.price}
													onInput={(e) =>
														updateEntry(
															entry.id,
															"price",
															Number(e.currentTarget.value),
														)
													}
													class="bg-zinc-800/50 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 w-full"
												/>
											</div>
											<div class="flex items-center gap-2">
												<span class="text-[10px] font-mono text-zinc-500">
													SZ:
												</span>
												<input
													type="number"
													step="0.01"
													value={entry.size}
													onInput={(e) =>
														updateEntry(
															entry.id,
															"size",
															Number(e.currentTarget.value),
														)
													}
													class="bg-zinc-800/50 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 w-full"
												/>
											</div>
										</div>
										<div class="text-right flex flex-col justify-between h-full">
											<p
												class={`text-xs font-mono font-bold ${
													(isShort()
														? entry.price - currentPrice()
														: currentPrice() - entry.price) *
														entry.size >=
													0
														? "text-emerald-500"
														: "text-rose-500"
												}`}
											>
												{(
													(isShort()
														? entry.price - currentPrice()
														: currentPrice() - entry.price) * entry.size
												).toFixed(2)}
												U
											</p>
											<button
												type="button"
												onClick={() => removeEntry(entry.id)}
												class="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-rose-500"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class="h-4 w-4"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<title>Remove Entry</title>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
													/>
												</svg>
											</button>
										</div>
									</div>
								</div>
							)}
						</For>
					</div>

					{/* Footer Info */}
					<div class="p-3 bg-indigo-500/5 flex items-center justify-center gap-4 border-t border-white/5">
						<div class="flex items-center gap-1.5">
							<span class="text-[8px] font-bold text-zinc-500 uppercase">
								Risk Level
							</span>
							<div class="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
								<div
									class={`h-full bg-indigo-500 transition-all duration-500`}
									style={{ width: `${Math.min(totalSize() * 200, 100)}%` }}
								></div>
							</div>
						</div>
					</div>
				</div>
			</Show>
		</>
	);
}
