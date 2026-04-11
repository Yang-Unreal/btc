import {
	children,
	createEffect,
	createMemo,
	createSignal,
	For,
	Index,
	type JSX,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import AllocationChart from "~/components/AllocationChart";
import PriceAlerts from "../components/PriceAlerts";
import { formatCryptoPrice } from "../lib/format";
import { globalStore } from "../lib/store";

// --- Types ---
interface Transaction {
	id: string;
	ticker: string;
	type: "BUY" | "SELL";
	amount: number;
	price: number;
	fee: number;
	date: string;
}

interface AssetHolding {
	amount: number;
	totalCost: number;
	averageBuyPrice: number;
	realizedPnL: number;
}

interface PortfolioResponse {
	transactions: Transaction[];
	holdings: Record<string, AssetHolding>;
	favorites: string[];
}

const INITIAL_DATA: PortfolioResponse = {
	transactions: [],
	holdings: {},
	favorites: [],
};

// --- Fetcher ---
const fetchPortfolioData = async (): Promise<PortfolioResponse> => {
	try {
		const res = await fetch("/api/portfolio");
		if (!res.ok) return INITIAL_DATA;
		return (await res.json()) as PortfolioResponse;
	} catch (e) {
		console.error("Portfolio fetch error:", e);
		return INITIAL_DATA;
	}
};

// --- Components ---
const Skeleton = (props: { class?: string }) => (
	<div
		class={`bg-white/5 animate-pulse rounded ${props.class || "h-6 w-24"}`}
	/>
);

export default function Profile() {
	return (
		// Main Background
		<div class="min-h-screen bg-[#09090b] text-slate-200 font-sans selection:bg-indigo-500/30">
			<div class="fixed inset-0 pointer-events-none">
				<div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
				<div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
			</div>

			<div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-16">
				<ProfileContent />
			</div>
		</div>
	);
}

function ProfileContent() {
	const { currency, loaded } = globalStore;

	// State
	const [portfolioData, setPortfolioData] =
		createSignal<PortfolioResponse>(INITIAL_DATA);
	const [isFetching, setIsFetching] = createSignal(true);
	const [prices, setPrices] = createSignal<Record<string, number>>({});

	// Modal State
	const [showModal, setShowModal] = createSignal(false);
	const [editingTxId, setEditingTxId] = createSignal<string | null>(null);

	// Form State
	const [ticker, setTicker] = createSignal("SOL");
	const [type, setType] = createSignal<"BUY" | "SELL">("BUY");
	const [amount, setAmount] = createSignal<string>("");
	const [price, setPrice] = createSignal<string>("");
	const [fee, setFee] = createSignal<string>("");
	const [submitting, setSubmitting] = createSignal(false);

	// Position Calculator State
	type OrderType = "market" | "limit";
	type Direction = "long" | "short";

	interface TPOrder {
		id: string;
		price: string;
		orderType: OrderType;
		positionPercent: number; // 0-100
	}

	interface SLOrder {
		id: string;
		price: string;
		orderType: OrderType;
		positionPercent: number;
	}

	const [positionCalc, setPositionCalc] = createSignal<{
		balance: string;
		leverage: string;
		positionSize: string;
		entryPrice: string;
		feeRate: string;
		orderType: OrderType;
		direction: Direction;
		takeProfitOrders: TPOrder[];
		stopLossOrders: SLOrder[];
	}>({
		balance: "10000",
		leverage: "10",
		positionSize: "0.1",
		entryPrice: "",
		feeRate: "0.0432",
		orderType: "market",
		direction: "long",
		takeProfitOrders: [],
		stopLossOrders: [],
	});

	// Add new TP/SL order
	const addTPOrder = () => {
		setPositionCalc((prev) => ({
			...prev,
			takeProfitOrders: [
				...prev.takeProfitOrders,
				{
					id: crypto.randomUUID(),
					price: "",
					orderType: "limit",
					positionPercent: 100,
				},
			],
		}));
	};

	const addSLOrder = () => {
		setPositionCalc((prev) => ({
			...prev,
			stopLossOrders: [
				...prev.stopLossOrders,
				{
					id: crypto.randomUUID(),
					price: "",
					orderType: "limit",
					positionPercent: 100,
				},
			],
		}));
	};

	const updateTPOrder = (
		id: string,
		field: keyof TPOrder,
		value: string | number,
	) => {
		setPositionCalc((prev) => ({
			...prev,
			takeProfitOrders: prev.takeProfitOrders.map((order) =>
				order.id === id ? { ...order, [field]: value } : order,
			),
		}));
	};

	const updateSLOrder = (
		id: string,
		field: keyof SLOrder,
		value: string | number,
	) => {
		setPositionCalc((prev) => ({
			...prev,
			stopLossOrders: prev.stopLossOrders.map((order) =>
				order.id === id ? { ...order, [field]: value } : order,
			),
		}));
	};

	const removeTPOrder = (id: string) => {
		setPositionCalc((prev) => ({
			...prev,
			takeProfitOrders: prev.takeProfitOrders.filter(
				(order) => order.id !== id,
			),
		}));
	};

	const removeSLOrder = (id: string) => {
		setPositionCalc((prev) => ({
			...prev,
			stopLossOrders: prev.stopLossOrders.filter((order) => order.id !== id),
		}));
	};

	// WebSocket for real-time BTC price
	let ws: WebSocket | undefined;
	let wsPingInterval: number | undefined;

	const connectWebSocket = () => {
		if (ws?.readyState === WebSocket.OPEN) return;

		ws = new WebSocket("wss://api.hyperliquid.xyz/ws");

		ws.onopen = () => {
			// Subscribe to trades for real-time last-price updates
			ws?.send(
				JSON.stringify({
					method: "subscribe",
					subscription: { type: "trades", coin: "BTC" },
				}),
			);
			// HL requires a ping every 30s
			wsPingInterval = window.setInterval(() => {
				if (ws?.readyState === WebSocket.OPEN) {
					ws.send(JSON.stringify({ method: "ping" }));
				}
			}, 30_000);
		};

		ws.onmessage = (event) => {
			try {
				const msg = JSON.parse(event.data);
				// Ignore pong / subscription ack
				if (
					!msg ||
					msg.channel === "subscriptionResponse" ||
					msg.channel === "pong"
				)
					return;

				// Real-time trades → extract last price
				if (
					msg.channel === "trades" &&
					Array.isArray(msg.data) &&
					msg.data.length > 0
				) {
					const lastTrade = msg.data[msg.data.length - 1];
					if (lastTrade?.coin === "BTC" && lastTrade?.px) {
						setPositionCalc((prev) => ({
							...prev,
							entryPrice: lastTrade.px,
						}));
					}
				}
			} catch {
				// ignore
			}
		};

		ws.onclose = () => {
			if (wsPingInterval) {
				window.clearInterval(wsPingInterval);
				wsPingInterval = undefined;
			}
		};
	};

	const disconnectWebSocket = () => {
		if (ws) {
			ws.close();
			ws = undefined;
		}
		if (wsPingInterval) {
			window.clearInterval(wsPingInterval);
			wsPingInterval = undefined;
		}
	};

	// Auto-fill entry price when order type changes to market
	const handleOrderTypeChange = (value: OrderType) => {
		const newFeeRate = value === "market" ? "0.0432" : "0.0144";
		setPositionCalc((prev) => ({
			...prev,
			orderType: value,
			feeRate: newFeeRate,
		}));
		if (value === "market") {
			connectWebSocket();
		} else {
			disconnectWebSocket();
		}
	};

	// Connect WebSocket on mount if market order
	onMount(() => {
		if (positionCalc().orderType === "market") {
			connectWebSocket();
		}
	});

	// Cleanup WebSocket on unmount
	onCleanup(() => {
		disconnectWebSocket();
	});

	const updateCalc = (field: string, value: string) => {
		setPositionCalc((prev) => ({ ...prev, [field]: value }));
	};

	const positionCalcResults = createMemo(() => {
		const calc = positionCalc();
		const balance = parseFloat(calc.balance) || 0;
		const leverage = parseFloat(calc.leverage) || 1;
		const positionSize = parseFloat(calc.positionSize) || 0;
		const entryPrice = parseFloat(calc.entryPrice) || 0;
		const feeRate = (parseFloat(calc.feeRate) || 0) / 100;
		const direction = calc.direction;
		const isLong = direction === "long";

		if (!positionSize || !entryPrice) return null;

		const positionValue = positionSize * entryPrice;
		const margin = positionValue / leverage;
		const fee = positionValue * feeRate * 2; // Open + Close fee
		const riskPercent = balance > 0 ? (margin / balance) * 100 : 0;

		// Calculate TP/SL from orders
		let totalStopLossUSDC = 0;
		let totalTakeProfitUSDC = 0;

		const calcPnL = (price: number, posPercent: number) => {
			const size = positionSize * (posPercent / 100);
			let pnl = 0;
			if (isLong) {
				pnl = (price - entryPrice) * size;
			} else {
				pnl = (entryPrice - price) * size;
			}
			return pnl;
		};

		for (const order of calc.stopLossOrders) {
			const slPrice = parseFloat(order.price) || 0;
			if (slPrice > 0) {
				const pnl = calcPnL(slPrice, order.positionPercent);
				totalStopLossUSDC += pnl;
			}
		}

		for (const order of calc.takeProfitOrders) {
			const tpPrice = parseFloat(order.price) || 0;
			if (tpPrice > 0) {
				const pnl = calcPnL(tpPrice, order.positionPercent);
				totalTakeProfitUSDC += pnl;
			}
		}

		return {
			positionValue,
			margin,
			fee,
			riskPercent,
			stopLossUSDC: totalStopLossUSDC,
			takeProfitUSDC: totalTakeProfitUSDC,
			stopLossOrders: calc.stopLossOrders,
			takeProfitOrders: calc.takeProfitOrders,
		};
	});

	const loadData = async () => {
		setIsFetching(true);
		const data = await fetchPortfolioData();
		setPortfolioData(data);
		globalStore.setPortfolio(data.holdings);
		setIsFetching(false);
	};

	onMount(() => loadData());

	const isLoading = () => !loaded() || isFetching();

	// --- Derived Calculations ---
	const totalBalance = createMemo(() => {
		const h = portfolioData().holdings;
		const p = prices();
		return Object.entries(h).reduce((acc, [tick, asset]) => {
			return acc + asset.amount * (p[tick] || 0);
		}, 0);
	});

	const totalProfit = createMemo(() => {
		const h = portfolioData().holdings;
		let realized = 0;
		let unrealized = 0;

		Object.values(h).forEach((a) => {
			realized += a.realizedPnL;
		});
		Object.entries(h).forEach(([t, a]) => {
			const currentVal = a.amount * (prices()[t] || 0);
			unrealized += currentVal - a.totalCost;
		});

		return realized + unrealized;
	});

	// --- Price Fetching Logic ---
	const fetchPrices = async (cur: string, tickers: string[]) => {
		if (tickers.length === 0) return;
		const pricePromises = tickers.map(async (t) => {
			try {
				const res = await fetch(
					`/api/history?interval=1m&symbol=${t}&currency=${cur}`,
				);
				const json = await res.json();
				if (Array.isArray(json) && json.length > 0) {
					const last = json[json.length - 1];
					if (last?.[4]) return { ticker: t, price: last[4] };
				}
			} catch {
				/* ignore */
			}
			return null;
		});

		const results = await Promise.all(pricePromises);
		const newPrices: Record<string, number> = {};
		for (const r of results) if (r) newPrices[r.ticker] = r.price;
		setPrices((prev) => ({ ...prev, ...newPrices }));
	};

	createEffect(() => {
		if (isLoading()) return;
		const data = portfolioData();
		const allTickers = Array.from(
			new Set([...Object.keys(data.holdings), ...data.favorites]),
		);
		if (allTickers.length > 0) fetchPrices(currency(), allTickers);
	});

	onMount(() => {
		const interval = setInterval(() => {
			if (isLoading()) return;
			const data = portfolioData();
			const allTickers = Array.from(
				new Set([...Object.keys(data.holdings), ...data.favorites]),
			);
			fetchPrices(currency(), allTickers);
		}, 30000);
		onCleanup(() => clearInterval(interval));
	});

	// --- Actions ---
	const toggleFavorite = async (ticker: string) => {
		await fetch("/api/portfolio", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ type: "TOGGLE_FAVORITE", ticker }),
		});
		await loadData();
	};

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		setSubmitting(true);
		try {
			const isEditing = editingTxId() !== null;
			await fetch("/api/portfolio", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: isEditing ? "UPDATE" : type(),
					id: isEditing ? editingTxId() : undefined,
					ticker: ticker(),
					txType: type(),
					amount: parseFloat(amount()),
					price: parseFloat(price()),
					fee: parseFloat(fee() || "0"),
				}),
			});
			await loadData();
			setShowModal(false);
			resetForm();
		} finally {
			setSubmitting(false);
		}
	};

	const resetForm = () => {
		setEditingTxId(null);
		setAmount("");
		setPrice("");
		setFee("");
		setTicker("SOL");
		setType("BUY");
	};

	const isFavorite = (ticker: string) =>
		portfolioData().favorites?.includes(ticker);

	// --- UI Helpers ---
	const Card = (props: { class?: string; children: JSX.Element }) => {
		const resolvedChildren = children(() => props.children);
		return (
			<div
				class={`bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl shadow-xl overflow-hidden ${props.class}`}
			>
				{resolvedChildren()}
			</div>
		);
	};

	return (
		<div class="space-y-6">
			{/* Header & Actions */}
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-white">
						Portfolio
					</h1>
					<p class="text-slate-400 text-xs sm:text-sm mt-1">
						Track your crypto assets and performance.
					</p>
				</div>
				<div class="flex items-center gap-2 sm:gap-3">
					<div class="flex-1 sm:flex-none flex items-center gap-2 bg-zinc-900/80 p-1 rounded-xl border border-white/10">
						<button
							type="button"
							onClick={() =>
								globalStore.setNotificationsEnabled(
									!globalStore.notificationsEnabled(),
								)
							}
							class={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-2 ${globalStore.notificationsEnabled() ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}
						>
							<div
								class={`w-2 h-2 rounded-full ${globalStore.notificationsEnabled() ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`}
							/>
							15M System {globalStore.notificationsEnabled() ? "ON" : "OFF"}
						</button>

						<button
							type="button"
							onClick={() =>
								globalStore.setFourHAlertEnabled(
									!globalStore.fourHAlertEnabled(),
								)
							}
							class={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-2 ${globalStore.fourHAlertEnabled() ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}
						>
							<div
								class={`w-2 h-2 rounded-full ${globalStore.fourHAlertEnabled() ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`}
							/>
							4H System {globalStore.fourHAlertEnabled() ? "ON" : "OFF"}
						</button>

						<button
							type="button"
							onClick={() =>
								globalStore.setVipSniper1hAlertEnabled(
									!globalStore.vipSniper1hAlertEnabled(),
								)
							}
							class={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-2 ${globalStore.vipSniper1hAlertEnabled() ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}
						>
							<div
								class={`w-2 h-2 rounded-full ${globalStore.vipSniper1hAlertEnabled() ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`}
							/>
							VIP Sniper 1h{" "}
							{globalStore.vipSniper1hAlertEnabled() ? "ON" : "OFF"}
						</button>
					</div>

					<button
						type="button"
						onClick={() => setShowModal(true)}
						class="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] sm:text-sm font-bold py-2 sm:py-3 px-4 sm:px-6 rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
					>
						<span class="text-lg leading-none">+</span>
						Tx
					</button>
				</div>
			</div>

			{/* Position Calculator */}
			<Card>
				<div class="p-4 sm:p-6">
					<h2 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
						<span class="text-indigo-400">⚖️</span>
						合约仓位计算器
					</h2>
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{/* Account Balance */}
						<div>
							<label
								for="calc-balance"
								class="block text-xs text-slate-400 mb-1"
							>
								账户余额 (USDC)
							</label>
							<input
								id="calc-balance"
								type="number"
								step="any"
								placeholder="10000"
								value={positionCalc().balance}
								onInput={(e) => updateCalc("balance", e.currentTarget.value)}
								class="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-sm"
							/>
						</div>

						{/* Leverage */}
						<div>
							<label
								for="calc-leverage"
								class="block text-xs text-slate-400 mb-1"
							>
								杠杆倍数
							</label>
							<select
								id="calc-leverage"
								value={positionCalc().leverage}
								onChange={(e) => updateCalc("leverage", e.currentTarget.value)}
								class="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-sm"
							>
								<For each={[1, 2, 3, 5, 10, 15, 20, 25, 30, 50, 100]}>
									{(lev) => <option value={lev}>{lev}x</option>}
								</For>
							</select>
						</div>

						{/* Position Size */}
						<div>
							<label
								for="calc-position-size"
								class="block text-xs text-slate-400 mb-1"
							>
								仓位数量
							</label>
							<input
								id="calc-position-size"
								type="number"
								step="any"
								placeholder="0.1"
								value={positionCalc().positionSize}
								onInput={(e) =>
									updateCalc("positionSize", e.currentTarget.value)
								}
								class="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-sm"
							/>
						</div>

						{/* Entry Price */}
						<div>
							<label
								for="calc-entry-price"
								class="block text-xs text-slate-400 mb-1"
							>
								开仓价格
							</label>
							<input
								id="calc-entry-price"
								type="number"
								step="any"
								placeholder="当前价格"
								value={positionCalc().entryPrice}
								onInput={(e) => updateCalc("entryPrice", e.currentTarget.value)}
								readOnly={positionCalc().orderType === "market"}
								class={`w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-sm ${positionCalc().orderType === "market" ? "opacity-50 cursor-not-allowed" : ""}`}
							/>
						</div>

						{/* Fee Rate */}
						<div>
							<label
								for="calc-fee-rate"
								class="block text-xs text-slate-400 mb-1"
							>
								手续费率 (%)
							</label>
							<input
								id="calc-fee-rate"
								type="number"
								step="any"
								placeholder="0.04"
								value={positionCalc().feeRate}
								onInput={(e) => updateCalc("feeRate", e.currentTarget.value)}
								class="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-sm"
							/>
						</div>

						{/* Order Type */}
						<div>
							<label
								for="calc-order-type"
								class="block text-xs text-slate-400 mb-1"
							>
								订单类型
							</label>
							<select
								id="calc-order-type"
								value={positionCalc().orderType}
								onChange={(e) =>
									handleOrderTypeChange(e.currentTarget.value as OrderType)
								}
								class="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-sm"
							>
								<option value="market">市价</option>
								<option value="limit">限价</option>
							</select>
						</div>

						{/* Direction */}
						<div>
							<span class="block text-xs text-slate-400 mb-1">方向</span>
							<div class="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => updateCalc("direction", "long")}
									class={`py-2 rounded-lg font-bold text-sm ${positionCalc().direction === "long" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50" : "bg-black/40 text-slate-500 border border-white/10"}`}
								>
									做多
								</button>
								<button
									type="button"
									onClick={() => updateCalc("direction", "short")}
									class={`py-2 rounded-lg font-bold text-sm ${positionCalc().direction === "short" ? "bg-rose-500/20 text-rose-400 border border-rose-500/50" : "bg-black/40 text-slate-500 border border-white/10"}`}
								>
									做空
								</button>
							</div>
						</div>

						{/* Stop Loss Orders */}
						<div class="md:col-span-2 lg:col-span-3">
							<div class="flex items-center justify-between mb-2">
								<span class="block text-xs text-slate-400">止损 (SL)</span>
								<button
									type="button"
									onClick={addSLOrder}
									class="text-xs text-rose-400 hover:text-rose-300"
								>
									+ 添加止损
								</button>
							</div>
							<div class="space-y-2">
								<Index each={positionCalc().stopLossOrders}>
									{(order) => (
										<div class="flex items-center gap-2">
											<select
												value={order().orderType}
												onChange={(e) =>
													updateSLOrder(
														order().id,
														"orderType",
														e.currentTarget.value,
													)
												}
												class="bg-black border border-white/10 rounded px-2 py-1 text-white text-xs"
											>
												<option value="market">市价</option>
												<option value="limit">限价</option>
											</select>
											<input
												type="number"
												step="any"
												placeholder="价格"
												value={order().price}
												onInput={(e) =>
													updateSLOrder(
														order().id,
														"price",
														e.currentTarget.value,
													)
												}
												class="flex-1 bg-black border border-white/10 rounded px-2 py-1 text-white text-xs font-mono"
											/>
											<input
												type="number"
												step="any"
												placeholder="仓位%"
												value={order().positionPercent}
												onInput={(e) =>
													updateSLOrder(
														order().id,
														"positionPercent",
														parseFloat(e.currentTarget.value) || 0,
													)
												}
												class="w-16 bg-black border border-white/10 rounded px-2 py-1 text-white text-xs font-mono"
											/>
											<span class="text-xs text-slate-500">%</span>
											<button
												type="button"
												onClick={() => removeSLOrder(order().id)}
												class="text-rose-500 hover:text-rose-400"
											>
												✕
											</button>
										</div>
									)}
								</Index>
								{positionCalc().stopLossOrders.length === 0 && (
									<div class="text-xs text-slate-600 italic">
										点击"+ 添加止损"添加止损订单
									</div>
								)}
							</div>
						</div>

						{/* Take Profit Orders */}
						<div class="md:col-span-2 lg:col-span-3">
							<div class="flex items-center justify-between mb-2">
								<span class="block text-xs text-slate-400">止盈 (TP)</span>
								<button
									type="button"
									onClick={addTPOrder}
									class="text-xs text-emerald-400 hover:text-emerald-300"
								>
									+ 添加止盈
								</button>
							</div>
							<div class="space-y-2">
								<Index each={positionCalc().takeProfitOrders}>
									{(order) => (
										<div class="flex items-center gap-2">
											<select
												value={order().orderType}
												onChange={(e) =>
													updateTPOrder(
														order().id,
														"orderType",
														e.currentTarget.value,
													)
												}
												class="bg-black border border-white/10 rounded px-2 py-1 text-white text-xs"
											>
												<option value="market">市价</option>
												<option value="limit">限价</option>
											</select>
											<input
												type="number"
												step="any"
												placeholder="价格"
												value={order().price}
												onInput={(e) =>
													updateTPOrder(
														order().id,
														"price",
														e.currentTarget.value,
													)
												}
												class="flex-1 bg-black border border-white/10 rounded px-2 py-1 text-white text-xs font-mono"
											/>
											<input
												type="number"
												step="any"
												placeholder="仓位%"
												value={order().positionPercent}
												onInput={(e) =>
													updateTPOrder(
														order().id,
														"positionPercent",
														parseFloat(e.currentTarget.value) || 0,
													)
												}
												class="w-16 bg-black border border-white/10 rounded px-2 py-1 text-white text-xs font-mono"
											/>
											<span class="text-xs text-slate-500">%</span>
											<button
												type="button"
												onClick={() => removeTPOrder(order().id)}
												class="text-rose-500 hover:text-rose-400"
											>
												✕
											</button>
										</div>
									)}
								</Index>
								{positionCalc().takeProfitOrders.length === 0 && (
									<div class="text-xs text-slate-600 italic">
										点击"+ 添加止盈"添加止盈订单
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Results */}
					{positionCalcResults() && (
						<div class="mt-6 p-4 bg-black/40 rounded-xl border border-white/10">
							<h3 class="text-sm font-bold text-slate-300 mb-3">计算结果</h3>
							<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
								<div class="text-center">
									<div class="text-xs text-slate-500">仓位价值</div>
									<div class="text-lg font-mono text-white">
										${positionCalcResults()?.positionValue.toFixed(2)}
									</div>
								</div>
								<div class="text-center">
									<div class="text-xs text-slate-500">所需保证金</div>
									<div class="text-lg font-mono text-indigo-400">
										${positionCalcResults()?.margin.toFixed(2)}
									</div>
								</div>
								<div class="text-center">
									<div class="text-xs text-slate-500">预估手续费</div>
									<div class="text-lg font-mono text-amber-400">
										${positionCalcResults()?.fee.toFixed(2)}
									</div>
								</div>
								<div class="text-center">
									<div class="text-xs text-slate-500">可承受风险</div>
									<div
										class={`text-lg font-mono ${(positionCalcResults()?.riskPercent ?? 0) > 0 ? "text-rose-400" : "text-slate-400"}`}
									>
										{positionCalcResults()?.riskPercent.toFixed(1)}%
									</div>
								</div>
							</div>
							{(positionCalcResults()?.stopLossOrders?.length ||
								positionCalcResults()?.takeProfitOrders?.length) && (
								<div class="mt-4 pt-4 border-t border-white/10">
									<div class="grid grid-cols-2 gap-4">
										{(positionCalcResults()?.stopLossOrders?.length ?? 0) >
											0 && (
											<div class="text-center p-3 bg-rose-500/10 rounded-lg border border-rose-500/30">
												<div class="text-xs text-rose-400 mb-1">止损 (SL)</div>
												<div
													class={`text-lg font-mono ${(positionCalcResults()?.stopLossUSDC ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}
												>
													{(positionCalcResults()?.stopLossUSDC ?? 0) >= 0
														? "+"
														: ""}
													{positionCalcResults()?.stopLossUSDC.toFixed(2)}
												</div>
												<div class="text-xs text-rose-500">
													{positionCalcResults()
														?.stopLossOrders.map(
															(o) =>
																`${o.orderType === "market" ? "市" : "限"} @ ${o.price || "-"} (${o.positionPercent}%)`,
														)
														.join(", ")}
												</div>
											</div>
										)}
										{(positionCalcResults()?.takeProfitOrders?.length ?? 0) >
											0 && (
											<div class="text-center p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
												<div class="text-xs text-emerald-400 mb-1">
													止盈 (TP)
												</div>
												<div
													class={`text-lg font-mono ${(positionCalcResults()?.takeProfitUSDC ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}
												>
													{(positionCalcResults()?.takeProfitUSDC ?? 0) >= 0
														? "+"
														: ""}
													{positionCalcResults()?.takeProfitUSDC.toFixed(2)}
												</div>
												<div class="text-xs text-emerald-500">
													{positionCalcResults()
														?.takeProfitOrders.map(
															(o) =>
																`${o.orderType === "market" ? "市" : "限"} @ ${o.price || "-"} (${o.positionPercent}%)`,
														)
														.join(", ")}
												</div>
											</div>
										)}
									</div>
								</div>
							)}
						</div>
					)}
				</div>
			</Card>
			<div class="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
				<Card class="p-4 sm:p-6 relative">
					<h3 class="text-[10px] sm:text-sm font-medium text-slate-400 uppercase tracking-wider mb-2 sm:mb-4">
						Net Worth
					</h3>
					<div class="text-lg sm:text-3xl font-bold text-white font-mono truncate">
						<Show
							when={!isLoading()}
							fallback={<Skeleton class="h-6 w-full sm:h-10 sm:w-40" />}
						>
							{formatCryptoPrice(totalBalance(), currency())}
						</Show>
					</div>
				</Card>

				<Card class="p-4 sm:p-6 relative">
					<h3 class="text-[10px] sm:text-sm font-medium text-slate-400 uppercase tracking-wider mb-2 sm:mb-4">
						Total PnL
					</h3>
					<div class="text-lg sm:text-3xl font-bold font-mono truncate">
						<Show
							when={!isLoading()}
							fallback={<Skeleton class="h-6 w-full sm:h-10 sm:w-40" />}
						>
							<span
								class={
									totalProfit() >= 0 ? "text-emerald-400" : "text-rose-400"
								}
							>
								{totalProfit() >= 0 ? "+" : ""}
								{formatCryptoPrice(totalProfit(), currency())}
							</span>
						</Show>
					</div>
				</Card>

				<Card class="col-span-2 md:col-span-1 p-4 sm:p-6 bg-linear-to-br from-indigo-500/10 to-purple-500/10">
					<h3 class="text-[10px] sm:text-sm font-medium text-indigo-200 uppercase tracking-wider mb-2 sm:mb-4">
						Health Score
					</h3>
					<div class="text-lg sm:text-3xl font-bold text-white">Grade: A+</div>
				</Card>
			</div>
			<div class="flex flex-col lg:grid lg:grid-cols-3 gap-6">
				{/* Left Column: Assets */}
				<div class="lg:col-span-2 space-y-6 order-2 lg:order-1">
					{/* Allocation Section */}
					<Card>
						<div class="p-4 sm:p-6 border-b border-white/5">
							<h3 class="font-bold text-sm sm:text-lg text-white">
								Asset Allocation
							</h3>
						</div>
						<div class="p-4 sm:p-6 flex justify-center overflow-hidden">
							<div class="w-full max-w-[300px] sm:max-w-full">
								<AllocationChart
									holdings={portfolioData().holdings}
									prices={prices()}
								/>
							</div>
						</div>
					</Card>

					{/* Your Assets - Card Style for Mobile */}
					<Card>
						<div class="p-4 sm:p-6 border-b border-white/5">
							<h3 class="font-bold text-sm sm:text-lg text-white">
								Your Assets
							</h3>
						</div>

						{/* Mobile Asset List */}
						<div class="md:hidden divide-y divide-white/5">
							<For each={Object.entries(portfolioData().holdings)}>
								{([ticker, h]) => {
									const getPrice = () => prices()[ticker];
									const getValue = () => {
										const p = getPrice();
										return p !== undefined ? h.amount * p : 0; // Fallback to 0 keeps the return type strictly `number`
									};
									const getPnlVal = () =>
										getValue() - h.totalCost + h.realizedPnL;

									return (
										<div class="p-4 flex items-center justify-between">
											<div class="flex items-center gap-3">
												<div class="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-[10px] font-black text-indigo-300">
													{ticker.substring(0, 2)}
												</div>
												<div>
													<div class="font-bold text-white text-sm">
														{ticker}
													</div>
													<div class="text-[10px] text-slate-500">
														{h.amount.toFixed(4)} {ticker}
													</div>
												</div>
											</div>
											<div class="text-right">
												<div class="text-sm font-bold text-white font-mono">
													{formatCryptoPrice(getValue(), currency())}
												</div>
												<div
													class={`text-[10px] font-mono ${getPnlVal() >= 0 ? "text-emerald-400" : "text-rose-400"}`}
												>
													{getPnlVal() >= 0 ? "+" : ""}
													{formatCryptoPrice(getPnlVal(), currency())}
												</div>
											</div>
										</div>
									);
								}}
							</For>
						</div>

						{/* Desktop Asset Table */}
						<div class="hidden md:block overflow-x-auto">
							<table class="w-full text-left">
								<thead class="bg-white/5 text-xs uppercase text-slate-400 font-semibold tracking-wider">
									<tr>
										<th class="p-4 w-10" />
										<th class="p-4">Asset</th>
										<th class="p-4 text-right">Price</th>
										<th class="p-4 text-right">Balance</th>
										<th class="p-4 text-right">Avg. Cost</th>
										<th class="p-4 text-right">PnL</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-white/5 text-sm">
									<For each={Object.entries(portfolioData().holdings)}>
										{([ticker, h]) => {
											const getPrice = () => prices()[ticker];
											const getValue = () => {
												const p = getPrice();
												return p !== undefined ? h.amount * p : null;
											};
											const getPnL = () => {
												const val = getValue();
												return val !== null
													? val - h.totalCost + h.realizedPnL
													: null;
											};

											return (
												<tr class="hover:bg-white/5 transition-colors group">
													<td class="p-4">
														<button
															type="button"
															onClick={() => toggleFavorite(ticker)}
															class={
																isFavorite(ticker)
																	? "text-amber-400"
																	: "text-slate-600"
															}
														>
															★
														</button>
													</td>
													<td class="p-4 font-bold">{ticker}</td>

													{/* Safe inline evaluation via IIFEs to enforce TypeScript type narrowing */}
													<td class="p-4 text-right font-mono">
														{(() => {
															const p = getPrice();
															return p !== undefined
																? formatCryptoPrice(p, currency())
																: "---";
														})()}
													</td>

													<td class="p-4 text-right font-mono font-bold">
														{(() => {
															const v = getValue();
															return v !== null
																? formatCryptoPrice(v, currency())
																: "--";
														})()}
													</td>

													<td class="p-4 text-right font-mono text-slate-400">
														{formatCryptoPrice(h.averageBuyPrice, currency())}
													</td>

													<td
														class={`p-4 text-right font-mono font-bold ${(getPnL() ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}
													>
														{(() => {
															const pnl = getPnL();
															return pnl !== null
																? formatCryptoPrice(pnl, currency())
																: "--";
														})()}
													</td>
												</tr>
											);
										}}
									</For>
								</tbody>
							</table>
						</div>
					</Card>
				</div>

				{/* Right Column: History & Alerts */}
				<div class="space-y-6 order-1 lg:order-2">
					<PriceAlerts />

					<Card class="flex flex-col max-h-[400px]">
						<div class="p-4 sm:p-6 border-b border-white/5 flex justify-between items-center">
							<h3 class="font-bold text-sm sm:text-lg text-white">
								Recent Activity
							</h3>
						</div>
						<div class="overflow-y-auto grow custom-scrollbar divide-y divide-white/5">
							<For each={portfolioData().transactions}>
								{(tx) => (
									<div class="p-4 flex items-center justify-between group">
										<div class="flex items-center gap-3">
											<div
												class={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${tx.type === "BUY" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}
											>
												{tx.type[0]}
											</div>
											<div>
												<div class="font-bold text-white text-sm capitalize">
													{tx.ticker}
												</div>
												<div class="text-[10px] text-slate-500 font-mono italic">
													{new Date(tx.date).toLocaleDateString()}
												</div>
											</div>
										</div>
										<div class="text-right">
											<div class="text-xs font-bold text-white font-mono">
												{tx.amount}
											</div>
											<div class="text-[10px] text-slate-500 font-mono">
												{formatCryptoPrice(tx.price, currency())}
											</div>
										</div>
									</div>
								)}
							</For>
						</div>
					</Card>
				</div>
			</div>
			<Show when={showModal()}>
				<div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
					<div class="bg-zinc-900 border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
						<div class="flex justify-between items-center mb-6">
							<h2 class="text-xl font-bold text-white">
								{editingTxId() ? "Edit" : "New Transaction"}
							</h2>
							<button
								type="button"
								onClick={() => {
									setShowModal(false);
									resetForm();
								}}
								class="text-slate-400 p-2"
							>
								✕
							</button>
						</div>

						<form onSubmit={handleSubmit} class="space-y-4">
							<select
								value={ticker()}
								onInput={(e) => setTicker(e.currentTarget.value)}
								class="w-full bg-black border border-white/10 rounded-xl px-4 py-4 text-white text-lg"
							>
								{[
									"BTC",
									"SOL",
									"SUI",
									"ETH",
									"PEPE",
									"TAO",
									"RENDER",
									"ONDO",
									"KAS",
									"VIRTUAL",
									"USDC",
								].map((t) => (
									<option value={t}>{t}</option>
								))}
							</select>
							<div class="grid grid-cols-2 gap-3">
								<button
									type="button"
									onClick={() => setType("BUY")}
									class={`py-3 rounded-xl font-bold ${type() === "BUY" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50" : "bg-black/40 text-slate-500"}`}
								>
									Buy
								</button>
								<button
									type="button"
									onClick={() => setType("SELL")}
									class={`py-3 rounded-xl font-bold ${type() === "SELL" ? "bg-rose-500/20 text-rose-400 border border-rose-500/50" : "bg-black/40 text-slate-500"}`}
								>
									Sell
								</button>
							</div>
							<div class="grid grid-cols-2 gap-3">
								<input
									type="number"
									step="any"
									required
									placeholder="Amount"
									value={amount()}
									onInput={(e) => setAmount(e.currentTarget.value)}
									class="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white font-mono"
								/>
								<input
									type="number"
									step="any"
									required
									placeholder="Price"
									value={price()}
									onInput={(e) => setPrice(e.currentTarget.value)}
									class="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white font-mono"
								/>
							</div>
							<button
								type="submit"
								disabled={submitting()}
								class="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg mt-2 active:scale-95 disabled:opacity-50"
							>
								{submitting() ? "Saving..." : "Confirm"}
							</button>
						</form>
					</div>
				</div>
			</Show>
		</div>
	);
}
