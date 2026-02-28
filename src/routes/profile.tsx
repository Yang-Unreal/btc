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

			{/* Top Summary Cards - Simplified for Mobile */}
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

			{/* Main Content Grid */}
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

			{/* Modal - Optimized for mobile tap targets */}
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
