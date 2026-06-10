// --- START OF FILE MacroPyramidCalculator.tsx ---

import {
	createEffect,
	createMemo,
	createSignal,
	For,
	onMount,
	Show,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";

interface LevelRow {
	level: number;
	customEntryPrice?: number;
	customLeverage?: number;
}

export default function MacroPyramidCalculator() {
	// ==========================================
	// 1. Core State Signals (Strictly USDC-Margined for Hyperliquid)
	// ==========================================
	const [isShort, setIsShort] = createSignal(true); // 默认做空 (配合你的截图测试)
	const [selectedCoin, setSelectedCoin] = createSignal("BTC");
	const [firstEntryPrice, setFirstEntryPrice] = createSignal(70000);
	const [initialCapital, setInitialCapital] = createSignal(1000); // Base USDC Capital
	const [globalLeverage, setGlobalLeverage] = createSignal(20);

// Hyperliquid Taker Fee Rate with Referral Discount (0.045% * 0.96 = 0.0432%)
const TAKER_FEE_RATE = 0.000432; // 0.0432%

	// ==========================================
	// 2. Rows Matrix Configuration State
	// ==========================================
	const [rows, setRows] = createStore<LevelRow[]>([
		{ level: 1 },
		{ level: 2 },
		{ level: 3 },
		{ level: 4 },
		{ level: 5 },
		{ level: 6 },
		{ level: 7 },
		{ level: 8 },
		{ level: 9 },
		{ level: 10 },
	]);

	const coins = [
		{ code: "BTC", name: "Bitcoin", price: 70000 },
		{ code: "ETH", name: "Ethereum", price: 3500 },
		{ code: "SOL", name: "Solana", price: 150 },
		{ code: "DOGE", name: "Dogecoin", price: 0.1 },
		{ code: "XRP", name: "Ripple", price: 0.5 },
	];

	// ==========================================
	// 3. Reactivity and Presets Synchronization
	// ==========================================
	createEffect(() => {
		const coin = coins.find((c) => c.code === selectedCoin());
		if (coin) {
			setFirstEntryPrice(coin.price);
		}
	});

	createEffect(() => {
		const params = {
			selectedCoin: selectedCoin(),
			firstEntryPrice: firstEntryPrice(),
			initialCapital: initialCapital(),
			globalLeverage: globalLeverage(),
			isShort: isShort(),
			rows: rows.map((r) => ({
				level: r.level,
				customEntryPrice: r.customEntryPrice,
				customLeverage: r.customLeverage,
			})),
		};
		localStorage.setItem("hyperliquid_rolling_v3", JSON.stringify(params));
	});

	onMount(() => {
		try {
			const saved = localStorage.getItem("hyperliquid_rolling_v3");
			if (saved) {
				const params = JSON.parse(saved);
				if (params.selectedCoin !== undefined)
					setSelectedCoin(params.selectedCoin);
				if (params.firstEntryPrice !== undefined)
					setFirstEntryPrice(params.firstEntryPrice);
				if (params.initialCapital !== undefined)
					setInitialCapital(params.initialCapital);
				if (params.globalLeverage !== undefined)
					setGlobalLeverage(params.globalLeverage);
				if (params.isShort !== undefined) setIsShort(params.isShort);
				if (params.rows !== undefined) setRows(reconcile(params.rows));
			}
		} catch (e) {
			console.error("Failed to restore parameters:", e);
		}
	});

	const getDefaultLeverage = (index: number, baseL: number) => {
		if (index === 0) return baseL;
		if (index === 1) return Math.max(2, baseL - 5);
		if (index === 2) return Math.max(2, baseL - 5);
		if (index === 3) return Math.max(2, baseL - 10);
		if (index === 4) return Math.max(2, baseL - 15);
		if (index === 5) return Math.max(2, Math.round(baseL * 0.2));
		if (index === 6) return Math.max(2, Math.round(baseL * 0.12));
		if (index === 7) return 2;
		if (index === 8) return 2;
		return 2;
	};

	const formatPrice = (price: number) => {
		if (price < 1) {
			return price.toLocaleString(undefined, {
				minimumFractionDigits: 4,
				maximumFractionDigits: 6,
			});
		}
		return price.toLocaleString(undefined, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});
	};

	// ==========================================
	// 4. Main Matrix Reactive Math Engine
	// ==========================================
	const computedRows = createMemo(() => {
		const result: any[] = [];
		const startPrice = firstEntryPrice();
		const cap = initialCapital();
		const baseL = globalLeverage();

		const getHyperliquidMMR = (coin: string) => {
			if (coin === "BTC") return 0.0125;
			if (coin === "ETH") return 0.02;
			if (coin === "SOL" || coin === "XRP") return 0.025;
			if (coin === "DOGE") return 0.05;
			return 0.025;
		};
		const mmr = getHyperliquidMMR(selectedCoin());

		let currentEntryPrice = startPrice;
		let currentCapital = cap;
		let previousCapital = cap; // 用于记录上一级的起始本金，判断回撤保本线
		let cumContractSizeTokens = 0;
		let cumPositionValUSDC = 0;

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			const level = i + 1;

			let entryPrice =
				level > 1 && row.customEntryPrice !== undefined
					? row.customEntryPrice
					: currentEntryPrice;
			entryPrice = Math.round(entryPrice * 1000000) / 1000000;

			const leverage =
				row.customLeverage !== undefined
					? row.customLeverage
					: getDefaultLeverage(i, baseL);
			const requiredMove = 1 / leverage;

			let targetPrice = isShort()
				? entryPrice * (1 - requiredMove)
				: entryPrice * (1 + requiredMove);
			targetPrice = Math.round(targetPrice * 1000000) / 1000000;
			currentEntryPrice = targetPrice;

			const holdingCapital = currentCapital;
			const positionSizeUSDC = holdingCapital * leverage;
			const positionSizeTokens = positionSizeUSDC / entryPrice;

			cumContractSizeTokens += positionSizeTokens;
			cumPositionValUSDC += positionSizeUSDC;
			let avgEntryPrice = cumPositionValUSDC / cumContractSizeTokens;
			avgEntryPrice = Math.round(avgEntryPrice * 1000000) / 1000000;

			let levelProfit = 0;
			if (isShort()) {
				levelProfit = (entryPrice - targetPrice) * positionSizeTokens;
			} else {
				levelProfit = (targetPrice - entryPrice) * positionSizeTokens;
			}

			// === 修正 2：只扣除单边手续费 ===
			// 连续滚仓到达目标价并不平仓，因此用来滚入下一级的资金只扣除开仓时的手续费损耗
			const openFee = positionSizeUSDC * TAKER_FEE_RATE;
			const levelFee = openFee;

			const netCompletedAssetUSDC = holdingCapital + levelProfit - levelFee;

			// === 修正 1：回吐上一级收益的分界线 (防守价) ===
			let rollbackPrice = 0;
			let rollbackPercent = 0;
			let liquidationPrice = 0;

			// 仅从第二级开始计算回吐防守线 (第一级没有上一级利润)
			if (level > 1) {
				// 允许亏损的最大金额 = 当前本金 - 本级开仓手续费 - 上一级的起始本金
				const allowedLoss = holdingCapital - openFee - previousCapital;
				if (allowedLoss > 0) {
					if (isShort()) {
						rollbackPrice = entryPrice + allowedLoss / positionSizeTokens;
					} else {
						rollbackPrice = entryPrice - allowedLoss / positionSizeTokens;
					}
					rollbackPercent = ((rollbackPrice - entryPrice) / entryPrice) * 100;
				}
			}

			// 爆仓价逻辑保持绝对精确 (包含开仓手续费扣除)
			if (isShort()) {
				liquidationPrice =
					(entryPrice * (1 + 1 / leverage - TAKER_FEE_RATE)) / (1 + mmr);
			} else {
				liquidationPrice =
					(entryPrice * (1 - 1 / leverage + TAKER_FEE_RATE)) / (1 - mmr);
			}

			if (liquidationPrice <= 0 || !isFinite(liquidationPrice))
				liquidationPrice = 0;
			if (rollbackPrice <= 0 || !isFinite(rollbackPrice)) rollbackPrice = 0;

			liquidationPrice = Math.round(liquidationPrice * 1000000) / 1000000;
			rollbackPrice = Math.round(rollbackPrice * 1000000) / 1000000;
			const liquidationPercent =
				entryPrice > 0
					? ((liquidationPrice - entryPrice) / entryPrice) * 100
					: 0;

			result.push({
				level,
				entryPrice,
				avgEntryPrice,
				targetPrice,
				requiredMove: requiredMove * 100,
				leverage,
				holdingCapital,
				positionSizeUSDC,
				positionSizeTokens,
				netCompletedAssetUSDC,
				levelProfit,
				levelFee,
				rollbackPrice,
				liquidationPrice,
				rollbackPercent,
				liquidationPercent,
				customEntryPrice: row.customEntryPrice,
				customLeverage: row.customLeverage,
			});

			// 为下一轮循环传递状态
			previousCapital = holdingCapital; // 将本级的起始资金存为下一级的“前级资金”
			currentCapital = netCompletedAssetUSDC; // 将滚仓后的净资产作为下一级的起始资金
		}

		return result;
	});

	const addLevel = () => {
		const newLvl = rows.length + 1;
		setRows(rows.length, { level: newLvl });
	};

	const removeLevel = (index: number) => {
		const newRows = rows
			.filter((_, idx) => idx !== index)
			.map((r, i) => ({
				...r,
				level: i + 1,
			}));
		setRows(reconcile(newRows));
	};

	const resetDefault = () => {
		setRows(
			reconcile([
				{ level: 1 },
				{ level: 2 },
				{ level: 3 },
				{ level: 4 },
				{ level: 5 },
				{ level: 6 },
				{ level: 7 },
				{ level: 8 },
				{ level: 9 },
				{ level: 10 },
			]),
		);
	};

	const updateRow = (
		index: number,
		field: "customEntryPrice" | "customLeverage",
		value: number | undefined,
	) => {
		setRows(index, field, value);
	};

	return (
		<div class="min-h-screen bg-[#070b13] text-zinc-100 flex flex-col font-sans antialiased p-4 sm:p-6 md:p-8">
			{/* Title Header */}
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-white/5 pb-4">
				<div class="flex items-baseline gap-3">
					<h1 class="text-xl sm:text-2xl font-bold text-white tracking-wide font-mono">
						滚仓计算器
					</h1>
					<span class="text-zinc-500 text-xs font-mono uppercase tracking-wider">
						Rolling Position Simulator
					</span>
				</div>

				<div class="flex items-center gap-3">
					<div class="bg-[#121824] p-1 rounded-xl border border-white/5 flex gap-1 font-mono text-xs">
						<button
							type="button"
							onClick={() => setIsShort(false)}
							class={`px-4 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all ${
								!isShort()
									? "bg-[#00c2ff] text-[#080c14] font-extrabold shadow-[0_0_15px_rgba(0,194,255,0.4)]"
									: "text-zinc-400 hover:text-zinc-200"
							}`}
						>
							{!isShort() && <span>✓</span>}
							做多
						</button>
						<button
							type="button"
							onClick={() => setIsShort(true)}
							class={`px-4 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all ${
								isShort()
									? "bg-[#ff4d4d] text-white font-extrabold shadow-[0_0_15px_rgba(255,77,77,0.4)]"
									: "text-zinc-400 hover:text-zinc-200"
							}`}
						>
							{isShort() && <span>✓</span>}
							做空
						</button>
					</div>
				</div>
			</div>

			{/* Top Parameters */}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
				<div class="bg-[#121824] border border-white/5 p-4 rounded-xl space-y-2 flex flex-col justify-between">
					<span class="text-zinc-500 text-[10px] font-bold block uppercase tracking-wider">
						选择币种
					</span>
					<select
						value={selectedCoin()}
						onChange={(e) => setSelectedCoin(e.currentTarget.value)}
						class="w-full bg-[#0b0e14] border border-white/10 hover:border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none font-bold font-mono appearance-none"
					>
						<For each={coins}>
							{(coin) => (
								<option value={coin.code}>
									{coin.code} - {coin.name}
								</option>
							)}
						</For>
					</select>
				</div>
				<div class="bg-[#121824] border border-white/5 p-4 rounded-xl space-y-2 flex flex-col justify-between">
					<span class="text-zinc-500 text-[10px] font-bold block uppercase tracking-wider">
						首次开仓价格 (USDC)
					</span>
					<input
						type="number"
						step="0.000001"
						value={firstEntryPrice()}
						onInput={(e) => setFirstEntryPrice(Number(e.currentTarget.value))}
						class="w-full bg-[#0b0e14] border border-white/10 hover:border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none font-bold font-mono"
					/>
				</div>
				<div class="bg-[#121824] border border-white/5 p-4 rounded-xl space-y-2 flex flex-col justify-between">
					<span class="text-zinc-500 text-[10px] font-bold block uppercase tracking-wider">
						初始本金 (USDC)
					</span>
					<input
						type="number"
						step="1"
						value={initialCapital()}
						onInput={(e) => setInitialCapital(Number(e.currentTarget.value))}
						class="w-full bg-[#0b0e14] border border-white/10 hover:border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none font-bold font-mono"
					/>
				</div>
				<div class="bg-[#121824] border border-white/5 p-4 rounded-xl space-y-2 flex flex-col justify-between">
					<span class="text-zinc-500 text-[10px] font-bold block uppercase tracking-wider">
						首层杠杆倍数
					</span>
					<div class="flex items-center gap-2">
						<input
							type="number"
							value={globalLeverage()}
							onInput={(e) => setGlobalLeverage(Number(e.currentTarget.value))}
							class="w-full bg-[#0b0e14] border border-white/10 hover:border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none font-bold font-mono"
						/>
						<span class="text-zinc-400 font-mono text-sm">倍</span>
					</div>
				</div>
				<div class="bg-[#121824] border border-white/5 p-4 rounded-xl space-y-2 flex flex-col justify-between">
					<span class="text-zinc-500 text-[10px] font-bold block uppercase tracking-wider">
						合约规则 (Hyperliquid)
					</span>
					<div class="w-full bg-[#0b0e14]/50 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-emerald-400 font-bold font-mono flex items-center gap-2 cursor-default">
						<span>⚡</span> USDC-Margined
					</div>
					<div class="text-[9px] text-zinc-400 font-mono leading-relaxed mt-1">
						<span>
							开仓手续费 <span class="text-emerald-400 font-bold">0.0432%</span>
						</span>
						<br />
						<span class="text-zinc-500">仅扣除单边手续费实现复利滚仓</span>
					</div>
				</div>
			</div>

			<div class="flex items-center justify-between mb-4">
				<div class="flex items-center gap-2">
					<span class="w-2.5 h-2.5 rounded-full bg-[#00c2ff] animate-pulse"></span>
					<h3 class="text-sm font-bold text-white tracking-wide font-mono">
						USDC本位 (全仓复利) · {isShort() ? "做空" : "做多"}
					</h3>
				</div>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onClick={addLevel}
						class="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/60 rounded-lg text-xs font-bold text-emerald-400 hover:text-white transition-all font-mono"
					>
						+ 添加级别
					</button>
					<button
						type="button"
						onClick={resetDefault}
						class="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold text-zinc-400 hover:text-white transition-all font-mono"
					>
						重置默认
					</button>
				</div>
			</div>

			{/* Main Matrix Grid */}
			<div class="flex-1 overflow-x-auto rounded-xl border border-white/5 bg-[#121824]/30 no-scrollbar mb-8 shadow-2xl">
				<table class="w-full text-left border-collapse font-mono text-[11px] min-w-[1450px]">
					<thead class="bg-[#121824] text-zinc-400 uppercase tracking-wider border-b border-white/5">
						<tr>
							<th class="p-4 w-12 text-center">级别</th>
							<th class="p-4">入场价格</th>
							<th class="p-4 text-right text-sky-400 font-bold">入场均价</th>
							<th class="p-4 text-right text-amber-500/90 font-bold">
								目标价格
							</th>
							<th class="p-4 text-right">所需涨幅</th>
							<th class="p-4 text-center">杠杆倍数</th>
							<th class="p-4 text-right">投入本金 (USDC)</th>
							<th class="p-4 text-right">名义仓位 (USDC)</th>
							<th class="p-4 text-right text-amber-500 font-bold">
								防守价 (保前级利润)
							</th>
							<th class="p-4 text-right text-rose-400 font-bold">
								爆仓价 (HL MMR)
							</th>
							<th class="p-4 text-right text-emerald-400">
								滚入下级资产 (USDC)
							</th>
							<th class="p-4 text-right text-[#00c2ff]">本级毛利</th>
							<th class="p-4 text-right text-rose-400">单边手续费</th>
							<th class="p-4 w-12"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-white/5 bg-[#121824]/10">
						<For each={computedRows()}>
							{(step, index) => (
								<tr class="hover:bg-white/2 transition-colors">
									<td class="p-4 text-center">
										<span class="w-6 h-6 rounded-lg bg-zinc-800/80 text-zinc-400 font-bold text-xs flex items-center justify-center mx-auto">
											{step.level}
										</span>
									</td>
									<td class="p-4">
										<Show
											when={step.level > 1}
											fallback={
												<span class="font-bold text-white text-xs">
													${formatPrice(step.entryPrice)}
												</span>
											}
										>
											<input
												type="number"
												step="0.000001"
												value={
													step.customEntryPrice !== undefined
														? step.customEntryPrice
														: step.entryPrice
												}
												onInput={(e) =>
													updateRow(
														index(),
														"customEntryPrice",
														e.currentTarget.value
															? Number(e.currentTarget.value)
															: undefined,
													)
												}
												class="bg-[#0b0e14] border border-white/10 hover:border-white/20 rounded px-2.5 py-1 text-xs text-white focus:outline-none w-36 font-mono font-bold"
											/>
										</Show>
									</td>
									<td class="p-4 text-right text-sky-400 font-extrabold text-xs">
										${formatPrice(step.avgEntryPrice)}
									</td>
									<td class="p-4 text-right font-extrabold text-[#ffa000] text-xs">
										${formatPrice(step.targetPrice)}
									</td>
									<td class="p-4 text-right">
										<span
											class={`font-extrabold text-xs ${!isShort() ? "text-emerald-400" : "text-rose-500"}`}
										>
											{!isShort() ? "+" : "-"}
											{step.requiredMove.toFixed(2)}%
										</span>
									</td>
									<td class="p-4 text-center">
										<div class="flex items-center justify-center gap-1.5">
											<input
												type="number"
												value={step.leverage}
												onInput={(e) =>
													updateRow(
														index(),
														"customLeverage",
														Number(e.currentTarget.value) > 0
															? Number(e.currentTarget.value)
															: undefined,
													)
												}
												class="bg-[#0b0e14] border border-white/10 hover:border-[#00c2ff]/40 focus:border-[#00c2ff] rounded px-1.5 py-0.5 text-xs text-white font-extrabold text-center font-mono w-14 focus:outline-none"
											/>
											<span class="text-zinc-500 text-[10px] font-bold">x</span>
										</div>
									</td>
									<td class="p-4 text-right text-white font-bold">
										$
										{step.holdingCapital.toLocaleString(undefined, {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										})}
									</td>
									<td class="p-4 text-right text-zinc-300 font-bold">
										$
										{step.positionSizeUSDC.toLocaleString(undefined, {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										})}
										<span class="text-zinc-500 text-[9px] font-bold block mt-0.5">
											≈{" "}
											{step.positionSizeTokens.toLocaleString(undefined, {
												minimumFractionDigits: 2,
												maximumFractionDigits: 6,
											})}{" "}
											{selectedCoin()}
										</span>
									</td>
									<td class="p-4 text-right text-[#ffb300] font-bold text-xs">
										<Show
											when={step.level > 1 && step.rollbackPrice > 0}
											fallback={
												<span class="text-zinc-700 font-normal">—</span>
											}
										>
											<p>${formatPrice(step.rollbackPrice)}</p>
											<span class="text-[#ffb300]/80 text-[9px] font-bold mt-0.5 block">
												({step.rollbackPercent >= 0 ? "+" : ""}
												{step.rollbackPercent.toFixed(2)}%)
											</span>
										</Show>
									</td>
									<td class="p-4 text-right text-rose-500 font-extrabold text-xs">
										<Show
											when={step.liquidationPrice > 0}
											fallback={<span class="text-zinc-600">—</span>}
										>
											<p>${formatPrice(step.liquidationPrice)}</p>
											<span class="text-rose-500/80 text-[9px] font-bold mt-0.5 block">
												({step.liquidationPercent >= 0 ? "+" : ""}
												{step.liquidationPercent.toFixed(2)}%)
											</span>
										</Show>
									</td>
									<td class="p-4 text-right text-emerald-400 font-extrabold text-xs">
										$
										{step.netCompletedAssetUSDC.toLocaleString(undefined, {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										})}
									</td>
									<td class="p-4 text-right">
										<p class="text-[#00c2ff] font-extrabold text-xs">
											+$
											{step.levelProfit.toLocaleString(undefined, {
												minimumFractionDigits: 2,
												maximumFractionDigits: 2,
											})}
										</p>
									</td>
									<td class="p-4 text-right">
										<p class="text-rose-400 font-extrabold text-xs">
											-$
											{step.levelFee.toLocaleString(undefined, {
												minimumFractionDigits: 2,
												maximumFractionDigits: 2,
											})}
										</p>
									</td>
									<td class="p-4 text-center">
										<button
											type="button"
											onClick={() => removeLevel(index())}
											class="text-zinc-600 hover:text-rose-500 transition-colors"
										>
											✕
										</button>
									</td>
								</tr>
							)}
						</For>
					</tbody>
				</table>
			</div>
		</div>
	);
}

// --- END OF FILE MacroPyramidCalculator.tsx ---
