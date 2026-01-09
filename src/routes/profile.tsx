import {
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
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
		if (!res.ok) {
			console.error("Failed to fetch portfolio:", res.status);
			return INITIAL_DATA;
		}
		return (await res.json()) as PortfolioResponse;
	} catch (e) {
		console.error("Portfolio fetch error:", e);
		return INITIAL_DATA;
	}
};

// --- Components ---
const Skeleton = (props: { class?: string }) => (
	<div
		class={`bg-slate-200 dark:bg-slate-800 animate-pulse rounded ${props.class || "h-8 w-32"}`}
	/>
);

const TableSkeleton = (props: { rows: number; cols: number }) => (
	<>
		<For each={Array(props.rows).fill(0)}>
			{() => (
				<tr class="animate-pulse border-b border-slate-100 dark:border-white/5">
					<For each={Array(props.cols).fill(0)}>
						{() => (
							<td class="p-4">
								<div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full opacity-50" />
							</td>
						)}
					</For>
				</tr>
			)}
		</For>
	</>
);

export default function Profile() {
	return (
		<div class="min-h-screen bg-[#0b0e14]">
			<ProfileContent />
		</div>
	);
}

function ProfileContent() {
	const { currency, loaded } = globalStore;

	// Initialize strictly
	const [portfolioData, setPortfolioData] =
		createSignal<PortfolioResponse>(INITIAL_DATA);
	const [isFetching, setIsFetching] = createSignal(true);

	const loadData = async () => {
		setIsFetching(true);
		const data = await fetchPortfolioData();
		setPortfolioData(data);
		globalStore.setPortfolio(data.holdings);
		setIsFetching(false);
	};

	onMount(() => {
		loadData();
	});

	const [prices, setPrices] = createSignal<Record<string, number>>({});
	const [activeTab, setActiveTab] = createSignal<"portfolio" | "watchlist">(
		"portfolio",
	);

	// Ensure we show loading state if global settings aren't ready OR we are fetching data
	const isLoading = () => !loaded() || isFetching();

	// --- Derived State ---
	const totalBalance = createMemo(() => {
		const h = portfolioData().holdings;
		let total = 0;
		Object.entries(h).forEach(([ticker, asset]) => {
			const price = prices()[ticker] || 0;
			total += asset.amount * price;
		});
		return total;
	});

	const totalProfit = createMemo(() => {
		const h = portfolioData().holdings;
		let realized = 0;
		let unrealized = 0;
		Object.values(h).forEach((a) => {
			realized += a.realizedPnL;
		});

		Object.entries(h).forEach(([ticker, asset]) => {
			const price = prices()[ticker] || 0;
			const currentVal = asset.amount * price;
			const costBasis = asset.totalCost;
			unrealized += currentVal - costBasis;
		});

		return realized + unrealized;
	});

	// --- Modal State ---
	const [showModal, setShowModal] = createSignal(false);
	const [editingTxId, setEditingTxId] = createSignal<string | null>(null);

	// --- Form State ---
	const [ticker, setTicker] = createSignal("SOL");
	const [type, setType] = createSignal<"BUY" | "SELL">("BUY");
	const [amount, setAmount] = createSignal<string>("");
	const [price, setPrice] = createSignal<string>("");
	const [fee, setFee] = createSignal<string>("");
	const [submitting, setSubmitting] = createSignal(false);

	// --- Live Price Logic ---
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
					if (last?.[4]) {
						return { ticker: t, price: last[4] };
					}
				}
			} catch (e) {
				console.error(`[Portfolio] Error fetching ${t}:`, e);
			}
			return null;
		});

		const results = await Promise.all(pricePromises);
		const newPrices: Record<string, number> = {};
		for (const result of results) {
			if (result) {
				newPrices[result.ticker] = result.price;
			}
		}
		setPrices((prev) => ({ ...prev, ...newPrices }));
	};

	createEffect(() => {
		if (isLoading()) return;

		const cur = currency();
		const data = portfolioData();
		const holdingTickers = Object.keys(data.holdings);
		const favTickers = data.favorites || [];
		const allTickers = Array.from(new Set([...holdingTickers, ...favTickers]));

		if (allTickers.length > 0) {
			fetchPrices(cur, allTickers);
		}
	});

	onMount(() => {
		const interval = setInterval(() => {
			if (isLoading()) return;
			const cur = currency();
			const data = portfolioData();
			const holdingTickers = Object.keys(data.holdings);
			const favTickers = data.favorites || [];
			const allTickers = Array.from(
				new Set([...holdingTickers, ...favTickers]),
			);
			fetchPrices(cur, allTickers);
		}, 30000);
		onCleanup(() => clearInterval(interval));
	});

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
			setEditingTxId(null);
			setAmount("");
			setPrice("");
			setFee("");
			setTicker("SOL");
			setType("BUY");
		} finally {
			setSubmitting(false);
		}
	};

	const isFavorite = (ticker: string) =>
		portfolioData().favorites?.includes(ticker);

	return (
		<div class="p-8 max-w-7xl mx-auto space-y-8 text-slate-800 dark:text-slate-200">
			{/* Summary Section */}
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Balance */}
				<div class="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-white/5 shadow-sm">
					<h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wide">
						Current Balance
					</h2>
					<div class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
						<Show when={!isLoading()} fallback={<Skeleton class="h-9 w-48" />}>
							{totalBalance() !== 0 ||
							Object.keys(portfolioData().holdings).length === 0
								? formatCryptoPrice(totalBalance(), currency())
								: "Loading..."}
						</Show>
					</div>
				</div>

				{/* Profit */}
				<div class="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-white/5 shadow-sm">
					<h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wide">
						Total Profit / Loss
					</h2>
					<div class="mt-2 text-3xl font-bold">
						<Show when={!isLoading()} fallback={<Skeleton class="h-9 w-48" />}>
							{totalProfit() !== 0 ||
							Object.keys(portfolioData().holdings).length === 0 ? (
								<span
									class={
										totalProfit() >= 0 ? "text-emerald-500" : "text-rose-500"
									}
								>
									{totalProfit() >= 0 ? "+" : ""}
									{formatCryptoPrice(totalProfit(), currency())}
								</span>
							) : (
								<span class="text-slate-500">Loading...</span>
							)}
						</Show>
					</div>
				</div>

				{/* Health */}
				<div class="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-center items-center relative overflow-hidden">
					<div class="z-10 text-center">
						<h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wide">
							Portfolio Health
						</h2>
						<div class="mt-2 text-xl font-bold text-indigo-400">
							Titan Grade: A+
						</div>
					</div>
					<div class="absolute inset-0 bg-linear-to-br from-indigo-500/10 to-purple-500/10" />
				</div>
			</div>

			{/* Tabs */}
			<div class="flex gap-4 border-b border-slate-200 dark:border-white/5">
				<button
					type="button"
					onClick={() => setActiveTab("portfolio")}
					class={`py-3 px-1 text-sm font-bold uppercase tracking-wide border-b-2 transition-colors ${activeTab() === "portfolio" ? "border-indigo-500 text-indigo-500" : "border-transparent text-slate-500 hover:text-slate-300"}`}
				>
					my portfolio
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("watchlist")}
					class={`py-3 px-1 text-sm font-bold uppercase tracking-wide border-b-2 transition-colors ${activeTab() === "watchlist" ? "border-indigo-500 text-indigo-500" : "border-transparent text-slate-500 hover:text-slate-300"}`}
				>
					watchlist
				</button>
			</div>

			{/* Main Content Area */}
			<Show when={activeTab() === "portfolio"}>
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
					<div class="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-white/5 shadow-sm min-h-[300px] flex items-center justify-center">
						<div class="text-center text-slate-500">
							<div class="w-40 h-40 rounded-full border-8 border-indigo-500/30 border-t-indigo-500 animate-spin-slow flex items-center justify-center mb-4 mx-auto">
								<span class="text-xs font-mono">ALLOCATION</span>
							</div>
						</div>
					</div>

					<div class="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden">
						<div class="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
							<h3 class="font-bold text-lg">Your Assets</h3>
							<button
								type="button"
								onClick={() => setShowModal(true)}
								class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors"
							>
								+ Add Transaction
							</button>
						</div>
						<div class="overflow-x-auto">
							<table class="w-full text-left">
								<thead class="bg-slate-50 dark:bg-white/5 text-xs uppercase text-slate-500 font-semibold">
									<tr>
										<th class="p-4 w-8" />
										<th class="p-4">Coin</th>
										<th class="p-4 text-right">Price</th>
										<th class="p-4 text-right">Holdings</th>
										<th class="p-4 text-right">Avg. Buy</th>
										<th class="p-4 text-right">Total Cost</th>
										<th class="p-4 text-right">PnL</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100 dark:divide-white/5">
									<Show
										when={!isLoading()}
										fallback={<TableSkeleton rows={5} cols={7} />}
									>
										<For each={Object.entries(portfolioData().holdings)}>
											{([ticker, h]) => {
												const getPrice = () => prices()[ticker];
												const getValue = () => {
													const p = getPrice();
													return p ? h.amount * p : null;
												};
												const getPnL = () => {
													const p = getPrice();
													const v = getValue();
													if (p === undefined || v === null) return null;
													return v - h.totalCost + h.realizedPnL;
												};

												return (
													<tr class="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
														<td class="p-4">
															<button
																type="button"
																onClick={() => toggleFavorite(ticker)}
																class={`text-lg ${isFavorite(ticker) ? "text-amber-400" : "text-slate-600 hover:text-slate-400"}`}
															>
																&#9733;
															</button>
														</td>
														<td class="p-4 font-bold">{ticker}</td>
														<td class="p-4 text-right font-mono text-slate-500">
															{getPrice()
																? formatCryptoPrice(getPrice(), currency())
																: "Loading..."}
														</td>
														<td class="p-4 text-right">
															<div class="font-bold">
																{(() => {
																	const val = getValue();
																	return val !== null
																		? formatCryptoPrice(val, currency())
																		: "Loading...";
																})()}
															</div>
															<div class="text-xs text-slate-500">
																{h.amount.toFixed(4)} {ticker}
															</div>
														</td>
														<td class="p-4 text-right font-mono text-slate-500">
															{formatCryptoPrice(h.averageBuyPrice, currency())}
														</td>
														<td class="p-4 text-right font-mono text-slate-500">
															{formatCryptoPrice(h.totalCost, currency())}
														</td>
														<td class="p-4 text-right font-bold">
															{(() => {
																const pnl = getPnL();
																return pnl !== null ? (
																	<span
																		class={
																			pnl >= 0
																				? "text-emerald-500"
																				: "text-rose-500"
																		}
																	>
																		{pnl >= 0 ? "+" : ""}
																		{formatCryptoPrice(pnl, currency())}
																	</span>
																) : (
																	<span class="text-slate-500">Loading...</span>
																);
															})()}
														</td>
													</tr>
												);
											}}
										</For>
										<Show
											when={Object.keys(portfolioData().holdings).length === 0}
										>
											<tr>
												<td colSpan={7} class="p-12 text-center text-slate-500">
													No assets yet. Add a transaction to get started!
												</td>
											</tr>
										</Show>
									</Show>
								</tbody>
							</table>
						</div>
					</div>
				</div>

				{/* Transaction History */}
				<div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden mt-8">
					<div class="p-6 border-b border-slate-100 dark:border-white/5">
						<h3 class="font-bold text-lg">Transaction History</h3>
					</div>
					<div class="overflow-x-auto">
						<table class="w-full text-left text-sm">
							<thead class="bg-slate-50 dark:bg-white/5 text-xs uppercase text-slate-500 font-semibold">
								<tr>
									<th class="p-4">Type</th>
									<th class="p-4">Asset</th>
									<th class="p-4 text-right">Price</th>
									<th class="p-4 text-right">Amount</th>
									<th class="p-4 text-right">Fee</th>
									<th class="p-4 text-right">Date</th>
									<th class="p-4 text-center">Actions</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100 dark:divide-white/5">
								<Show
									when={!isLoading()}
									fallback={<TableSkeleton rows={5} cols={7} />}
								>
									<For each={portfolioData().transactions}>
										{(tx) => (
											<tr class="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
												<td
													class={`p-4 font-bold uppercase ${tx.type === "BUY" ? "text-emerald-500" : "text-rose-500"}`}
												>
													{tx.type}
												</td>
												<td class="p-4 font-bold">{tx.ticker}</td>
												<td class="p-4 text-right font-mono text-slate-500">
													{formatCryptoPrice(tx.price, currency())}
												</td>
												<td class="p-4 text-right font-mono">{tx.amount}</td>
												<td class="p-4 text-right font-mono text-slate-500">
													{formatCryptoPrice(tx.fee, currency())}
												</td>
												<td class="p-4 text-right text-slate-500">
													{new Date(tx.date).toLocaleDateString()}
												</td>
												<td class="p-4 text-center">
													<div class="flex justify-center gap-2">
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
															class="text-indigo-400 hover:text-indigo-300 text-xs font-bold"
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
															class="text-rose-400 hover:text-rose-300 text-xs font-bold"
														>
															Delete
														</button>
													</div>
												</td>
											</tr>
										)}
									</For>
								</Show>
							</tbody>
						</table>
					</div>
				</div>
			</Show>

			<Show when={activeTab() === "watchlist"}>
				<div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden">
					<div class="p-6 border-b border-slate-100 dark:border-white/5">
						<h3 class="font-bold text-lg">My Watchlist</h3>
					</div>
					<div class="overflow-x-auto">
						<table class="w-full text-left">
							<thead class="bg-slate-50 dark:bg-white/5 text-xs uppercase text-slate-500 font-semibold">
								<tr>
									<th class="p-4 w-8" />
									<th class="p-4">Coin</th>
									<th class="p-4 text-right">Price</th>
									<th class="p-4 text-right">24h Change (Sim)</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100 dark:divide-white/5">
								<Show
									when={!isLoading()}
									fallback={<TableSkeleton rows={5} cols={4} />}
								>
									<For each={portfolioData().favorites || []}>
										{(ticker) => (
											<tr class="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
												<td class="p-4">
													<button
														type="button"
														onClick={() => toggleFavorite(ticker)}
														class="text-amber-400 text-lg hover:text-amber-300"
													>
														&#9733;
													</button>
												</td>
												<td class="p-4 font-bold">{ticker}</td>
												<td class="p-4 text-right font-mono">
													{prices()[ticker]
														? formatCryptoPrice(prices()[ticker], currency())
														: "Loading..."}
												</td>
												<td class="p-4 text-right text-slate-500">--</td>
											</tr>
										)}
									</For>
									<Show
										when={
											!portfolioData().favorites ||
											portfolioData().favorites.length === 0
										}
									>
										<tr>
											<td colSpan={4} class="p-12 text-center text-slate-500">
												No favorites yet. Go to "My Portfolio" and star some
												assets!
											</td>
										</tr>
									</Show>
								</Show>
							</tbody>
						</table>
					</div>
				</div>
			</Show>

			{/* Modal omitted for brevity, logic remains same */}
			<Show when={showModal()}>
				<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
					<div class="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
						<div class="flex justify-between items-center mb-6">
							<h2 class="text-xl font-bold text-white">
								{editingTxId() ? "Edit Transaction" : "Add Transaction"}
							</h2>
							<button
								type="button"
								onClick={() => {
									setShowModal(false);
									setEditingTxId(null);
									setTicker("SOL");
									setType("BUY");
									setAmount("");
									setPrice("");
									setFee("");
								}}
								class="text-slate-400 hover:text-white"
							>
								✕
							</button>
						</div>

						<form onSubmit={handleSubmit} class="space-y-4">
							{/* Form Content */}
							<div>
								<label
									for="asset"
									class="block text-xs uppercase text-slate-500 font-bold mb-1"
								>
									Asset
								</label>
								<select
									id="asset"
									value={ticker()}
									onInput={(e) => setTicker(e.currentTarget.value)}
									class="w-full bg-slate-800 border border-white/10 rounded px-3 py-3 text-white focus:outline-none focus:border-indigo-500"
								>
									<option value="BTC">BTC</option>
									<option value="SOL">SOL</option>
									<option value="SUI">SUI</option>
									<option value="PEPE">PEPE</option>
									<option value="TAO">TAO</option>
									<option value="RENDER">RENDER</option>
									<option value="ONDO">ONDO</option>
									<option value="KAS">KAS</option>
									<option value="VIRTUAL">VIRTUAL</option>
								</select>
							</div>
							<div class="grid grid-cols-2 gap-4">
								<div>
									<label
										for="type"
										class="block text-xs uppercase text-slate-500 font-bold mb-1"
									>
										Type
									</label>
									<select
										id="type"
										value={type()}
										onInput={(e) =>
											setType(e.currentTarget.value as "BUY" | "SELL")
										}
										class="w-full bg-slate-800 border border-white/10 rounded px-3 py-3 text-white focus:outline-none focus:border-indigo-500"
									>
										<option value="BUY">Buy</option>
										<option value="SELL">Sell</option>
									</select>
								</div>
								<div>
									<label
										for="amount"
										class="block text-xs uppercase text-slate-500 font-bold mb-1"
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
										class="w-full bg-slate-800 border border-white/10 rounded px-3 py-3 text-white focus:outline-none focus:border-indigo-500"
									/>
								</div>
							</div>
							<div class="grid grid-cols-2 gap-4">
								<div>
									<label
										for="price"
										class="block text-xs uppercase text-slate-500 font-bold mb-1"
									>
										Price
									</label>
									<input
										id="price"
										type="number"
										step="any"
										required
										value={price()}
										onInput={(e) => setPrice(e.currentTarget.value)}
										class="w-full bg-slate-800 border border-white/10 rounded px-3 py-3 text-white focus:outline-none focus:border-indigo-500"
									/>
								</div>
								<div>
									<label
										for="fee"
										class="block text-xs uppercase text-slate-500 font-bold mb-1"
									>
										Fee
									</label>
									<input
										id="fee"
										type="number"
										step="any"
										value={fee()}
										onInput={(e) => setFee(e.currentTarget.value)}
										class="w-full bg-slate-800 border border-white/10 rounded px-3 py-3 text-white focus:outline-none focus:border-indigo-500"
									/>
								</div>
							</div>
							<button
								type="submit"
								disabled={submitting()}
								class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition-colors mt-4"
							>
								{submitting() ? "Processing..." : "Submit Transaction"}
							</button>
						</form>
					</div>
				</div>
			</Show>
		</div>
	);
}
