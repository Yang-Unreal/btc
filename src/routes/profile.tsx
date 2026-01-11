import {
	children,
	createEffect,
	createMemo,
	createSignal,
	For,
	type JSX,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import AllocationChart from "~/components/AllocationChart";
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

			{/* Added standard container width to match index.tsx */}
			<div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
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
	const [activeTab, setActiveTab] = createSignal<"dashboard" | "watchlist">(
		"dashboard",
	);

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
			<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h1 class="text-3xl font-bold tracking-tight text-white">
						Portfolio
					</h1>
					<p class="text-slate-400 text-sm mt-1">
						Track your crypto assets and performance.
					</p>
				</div>
				<div class="flex items-center gap-3">
					{/* Tab Switcher */}
					<div class="bg-zinc-900/80 p-1 rounded-xl border border-white/10 flex">
						<button
							type="button"
							onClick={() => setActiveTab("dashboard")}
							class={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab() === "dashboard" ? "bg-zinc-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
						>
							Dashboard
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("watchlist")}
							class={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab() === "watchlist" ? "bg-zinc-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
						>
							Watchlist
						</button>
					</div>

					<button
						type="button"
						onClick={() => setShowModal(true)}
						class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
					>
						<span class="text-lg leading-none">+</span>
						Transaction
					</button>
				</div>
			</div>

			{/* Top Summary Cards */}
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
				<Card class="p-6 relative group hover:border-white/10 transition-colors">
					<div class="flex justify-between items-start mb-4">
						<h3 class="text-sm font-medium text-slate-400 uppercase tracking-wider">
							Net Worth
						</h3>
						<div class="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
							<svg
								class="w-5 h-5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<title>Wallet Icon</title>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						</div>
					</div>
					<div class="text-3xl font-bold text-white font-mono tracking-tight">
						<Show when={!isLoading()} fallback={<Skeleton class="h-10 w-40" />}>
							{formatCryptoPrice(totalBalance(), currency())}
						</Show>
					</div>
				</Card>

				<Card class="p-6 relative group hover:border-white/10 transition-colors">
					<div class="flex justify-between items-start mb-4">
						<h3 class="text-sm font-medium text-slate-400 uppercase tracking-wider">
							Total PnL
						</h3>
						<div
							class={`p-2 rounded-lg ${totalProfit() >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}
						>
							<svg
								class="w-5 h-5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<title>Chart Icon</title>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
								/>
							</svg>
						</div>
					</div>
					<div class="text-3xl font-bold font-mono tracking-tight">
						<Show when={!isLoading()} fallback={<Skeleton class="h-10 w-40" />}>
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

				<Card class="p-6 relative group hover:border-white/10 transition-colors bg-linear-to-br from-indigo-500/10 to-purple-500/10">
					<div class="flex justify-between items-start mb-4">
						<h3 class="text-sm font-medium text-indigo-200 uppercase tracking-wider">
							Portfolio Health
						</h3>
						<div class="p-2 bg-indigo-500/20 rounded-lg text-indigo-300">
							<svg
								class="w-5 h-5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<title>Shield Icon</title>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						</div>
					</div>
					<div class="text-3xl font-bold text-white tracking-tight">
						Grade: A+
					</div>
					<p class="text-xs text-indigo-200/60 mt-2">
						Based on diversification & performance
					</p>
				</Card>
			</div>

			<Show when={activeTab() === "dashboard"}>
				{/* Main Dashboard Grid */}
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Left Column: Chart & Assets (2/3 width) */}
					<div class="lg:col-span-2 space-y-6">
						{/* Allocation Section */}
						<Card>
							<div class="p-6 border-b border-white/5 flex justify-between items-center">
								<h3 class="font-bold text-lg text-white">Asset Allocation</h3>
							</div>
							<div class="p-6">
								<AllocationChart
									holdings={portfolioData().holdings}
									prices={prices()}
								/>
							</div>
						</Card>

						{/* Holdings Table */}
						<Card>
							<div class="p-6 border-b border-white/5">
								<h3 class="font-bold text-lg text-white">Your Assets</h3>
							</div>
							<div class="overflow-x-auto">
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
									<tbody class="divide-y divide-white/5">
										<Show
											when={!isLoading()}
											fallback={
												<tr>
													<td colSpan={6} class="p-8 text-center">
														<Skeleton class="w-full h-8" />
													</td>
												</tr>
											}
										>
											<For each={Object.entries(portfolioData().holdings)}>
												{([ticker, h]) => {
													const getPrice = () => prices()[ticker];
													const getValue = () => {
														const p = getPrice();
														return p ? h.amount * p : null;
													};
													const getPnL = () => {
														const val = getValue();
														if (val === null) return null;
														return val - h.totalCost + h.realizedPnL;
													};

													return (
														<tr class="hover:bg-white/5 transition-colors group">
															<td class="p-4">
																<button
																	type="button"
																	onClick={() => toggleFavorite(ticker)}
																	class="text-slate-600 hover:text-amber-400 transition-colors"
																>
																	<span
																		class={
																			isFavorite(ticker) ? "text-amber-400" : ""
																		}
																	>
																		★
																	</span>
																</button>
															</td>
															<td class="p-4">
																<div class="flex items-center gap-3">
																	<div class="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-300">
																		{ticker[0]}
																	</div>
																	<div>
																		<div class="font-bold text-white">
																			{ticker}
																		</div>
																		<div class="text-xs text-slate-500">
																			{h.amount.toFixed(4)} {ticker}
																		</div>
																	</div>
																</div>
															</td>
															<td class="p-4 text-right font-mono text-slate-300">
																{getPrice()
																	? formatCryptoPrice(getPrice(), currency())
																	: "..."}
															</td>
															<td class="p-4 text-right">
																<div class="font-bold font-mono text-white">
																	{(() => {
																		const value = getValue();
																		return value !== null
																			? formatCryptoPrice(value, currency())
																			: "...";
																	})()}
																</div>
																<div class="text-xs text-slate-500 font-mono">
																	Cost:{" "}
																	{formatCryptoPrice(h.totalCost, currency())}
																</div>
															</td>
															<td class="p-4 text-right font-mono text-slate-400">
																{formatCryptoPrice(
																	h.averageBuyPrice,
																	currency(),
																)}
															</td>
															<td class="p-4 text-right font-bold font-mono">
																{(() => {
																	const pnl = getPnL();
																	if (pnl === null) return "...";
																	return (
																		<span
																			class={
																				pnl >= 0
																					? "text-emerald-400"
																					: "text-rose-400"
																			}
																		>
																			{pnl >= 0 ? "+" : ""}
																			{formatCryptoPrice(pnl, currency())}
																		</span>
																	);
																})()}
															</td>
														</tr>
													);
												}}
											</For>
										</Show>
									</tbody>
								</table>
								<Show when={Object.keys(portfolioData().holdings).length === 0}>
									<div class="p-12 text-center text-slate-500">
										No assets found. Start by adding a transaction.
									</div>
								</Show>
							</div>
						</Card>
					</div>

					{/* Right Column: History (1/3 width) */}
					<div class="lg:col-span-1">
						<Card class="h-full max-h-[800px] flex flex-col">
							<div class="p-6 border-b border-white/5 bg-zinc-900/50 sticky top-0 z-10">
								<h3 class="font-bold text-lg text-white">Recent Activity</h3>
							</div>
							<div class="overflow-y-auto flex-1 custom-scrollbar p-2">
								<Show when={portfolioData().transactions.length === 0}>
									<div class="text-center p-8 text-slate-500 text-sm">
										No transactions yet.
									</div>
								</Show>
								<div class="space-y-2">
									<For each={portfolioData().transactions}>
										{(tx) => (
											<div class="p-3 hover:bg-white/5 rounded-xl border border-transparent hover:border-white/5 transition-all group">
												<div class="flex justify-between items-start mb-1">
													<div class="flex items-center gap-2">
														<span
															class={`text-xs font-bold px-2 py-0.5 rounded ${tx.type === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}
														>
															{tx.type}
														</span>
														<span class="font-bold text-white">
															{tx.ticker}
														</span>
													</div>
													<span class="text-xs text-slate-500">
														{new Date(tx.date).toLocaleDateString()}
													</span>
												</div>
												<div class="flex justify-between items-end">
													<div>
														<div class="text-xs text-slate-400">
															Price: {formatCryptoPrice(tx.price, currency())}
														</div>
														<div class="text-xs text-slate-400">
															Amt: {tx.amount}
														</div>
													</div>
													<div class="opacity-0 group-hover:opacity-100 flex gap-2 transition-opacity">
														<button
															type="button"
															onClick={() => {
																setEditingTxId(tx.id);
																setTicker(tx.ticker);
																setType(tx.type);
																setAmount(String(tx.amount));
																setPrice(String(tx.price));
																setFee(String(tx.fee));
																setShowModal(true);
															}}
															class="text-xs text-indigo-400 hover:text-indigo-300 font-bold"
														>
															Edit
														</button>
														<button
															type="button"
															onClick={async () => {
																if (confirm("Delete this transaction?")) {
																	await fetch("/api/portfolio", {
																		method: "POST",
																		headers: {
																			"Content-Type": "application/json",
																		},
																		body: JSON.stringify({
																			type: "DELETE",
																			id: tx.id,
																		}),
																	});
																	await loadData();
																}
															}}
															class="text-xs text-rose-400 hover:text-rose-300 font-bold"
														>
															Del
														</button>
													</div>
												</div>
											</div>
										)}
									</For>
								</div>
							</div>
						</Card>
					</div>
				</div>
			</Show>

			<Show when={activeTab() === "watchlist"}>
				<Card>
					<div class="p-6 border-b border-white/5">
						<h3 class="font-bold text-lg text-white">Watchlist</h3>
					</div>
					<div class="overflow-x-auto">
						<table class="w-full text-left">
							<thead class="bg-white/5 text-xs uppercase text-slate-400 font-semibold tracking-wider">
								<tr>
									<th class="p-4 w-10" />
									<th class="p-4">Coin</th>
									<th class="p-4 text-right">Current Price</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-white/5">
								<For each={portfolioData().favorites || []}>
									{(ticker) => (
										<tr class="hover:bg-white/5 transition-colors">
											<td class="p-4">
												<button
													type="button"
													onClick={() => toggleFavorite(ticker)}
													class="text-amber-400 hover:text-amber-300 text-lg"
												>
													★
												</button>
											</td>
											<td class="p-4 font-bold text-white text-lg">{ticker}</td>
											<td class="p-4 text-right font-mono text-xl text-indigo-300">
												{prices()[ticker] ? (
													formatCryptoPrice(prices()[ticker], currency())
												) : (
													<span class="text-slate-600 text-base">
														Loading...
													</span>
												)}
											</td>
										</tr>
									)}
								</For>
								<Show when={!portfolioData().favorites?.length}>
									<tr>
										<td colSpan={3} class="p-12 text-center text-slate-500">
											Your watchlist is empty.
										</td>
									</tr>
								</Show>
							</tbody>
						</table>
					</div>
				</Card>
			</Show>

			{/* Modal */}
			<Show when={showModal()}>
				<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all">
					<div class="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden">
						{/* Glow effect in modal */}
						<div class="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-[60px] rounded-full pointer-events-none" />

						<div class="flex justify-between items-center mb-6 relative z-10">
							<h2 class="text-xl font-bold text-white">
								{editingTxId() ? "Edit Transaction" : "Add Transaction"}
							</h2>
							<button
								type="button"
								onClick={() => {
									setShowModal(false);
									resetForm();
								}}
								class="text-slate-400 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
							>
								✕
							</button>
						</div>

						<form onSubmit={handleSubmit} class="space-y-5 relative z-10">
							<div>
								<label
									for="asset-symbol"
									class="block text-xs uppercase text-slate-400 font-bold mb-2 ml-1"
								>
									Asset Symbol
								</label>
								{/* Simple Select for demo, could be a search input */}
								<select
									id="asset-symbol"
									value={ticker()}
									onInput={(e) => setTicker(e.currentTarget.value)}
									class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none"
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
							</div>

							<div class="grid grid-cols-2 gap-4">
								<div>
									<label
										for="transaction-type"
										class="block text-xs uppercase text-slate-400 font-bold mb-2 ml-1"
									>
										Type
									</label>
									<div class="flex bg-black/40 rounded-xl p-1 border border-white/10">
										<button
											type="button"
											onClick={() => setType("BUY")}
											class={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${type() === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "text-slate-500"}`}
										>
											Buy
										</button>
										<button
											type="button"
											onClick={() => setType("SELL")}
											class={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${type() === "SELL" ? "bg-rose-500/20 text-rose-400" : "text-slate-500"}`}
										>
											Sell
										</button>
									</div>
								</div>
								<div>
									<label
										for="amount"
										class="block text-xs uppercase text-slate-400 font-bold mb-2 ml-1"
									>
										Amount
									</label>
									<input
										id="amount"
										type="number"
										step="any"
										required
										value={amount()}
										onInput={(e) => setAmount(e.currentTarget.value)}
										class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 font-mono"
										placeholder="0.00"
									/>
								</div>
							</div>

							<div class="grid grid-cols-2 gap-4">
								<div>
									<label
										for="price"
										class="block text-xs uppercase text-slate-400 font-bold mb-2 ml-1"
									>
										Price per Coin
									</label>
									<input
										id="price"
										type="number"
										step="any"
										required
										value={price()}
										onInput={(e) => setPrice(e.currentTarget.value)}
										class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 font-mono"
										placeholder="0.00"
									/>
								</div>
								<div>
									<label
										for="fee"
										class="block text-xs uppercase text-slate-400 font-bold mb-2 ml-1"
									>
										Fee
									</label>
									<input
										id="fee"
										type="number"
										step="any"
										value={fee()}
										onInput={(e) => setFee(e.currentTarget.value)}
										class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 font-mono"
										placeholder="0.00"
									/>
								</div>
							</div>

							<button
								type="submit"
								disabled={submitting()}
								class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-600/20 transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{submitting()
									? "Processing..."
									: editingTxId()
										? "Update Transaction"
										: "Add Transaction"}
							</button>
						</form>
					</div>
				</div>
			</Show>
		</div>
	);
}
