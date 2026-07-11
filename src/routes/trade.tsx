import {
	type ISubscription,
	SubscriptionClient,
	WebSocketTransport,
} from "@nktkas/hyperliquid";
import { Title } from "@solidjs/meta";
import {
	For,
	Show,
	createEffect,
	createSignal,
	onCleanup,
	onMount,
} from "solid-js";

interface Market {
	symbol: string;
	szDecimals: number;
	maxLeverage: number;
	mid: string | null;
}

interface MarketsResponse {
	network: string;
	address: string;
	markets: Market[];
	error?: string;
}

interface OrderResult {
	result?: {
		response?: {
			data?: {
				statuses?: Array<
					| { filled: { avgPx: string; totalSz: string; oid: number } }
					| { error: string }
					| { resting: { oid: number } }
					| string
				>;
			};
		};
	};
	error?: string;
}

export default function Trade() {
	const [markets, setMarkets] = createSignal<Market[]>([]);
	const [network, setNetwork] = createSignal("");
	const [address, setAddress] = createSignal("");
	const [loadError, setLoadError] = createSignal("");

	// Live mark/mid price for the selected coin, streamed over the Hyperliquid
	// WebSocket `activeAssetCtx` subscription (~1 Hz).
	const [livePrice, setLivePrice] = createSignal<string | null>(null);
	const [feedLive, setFeedLive] = createSignal(false);

	const [coin, setCoin] = createSignal("BTC");
	const [isBuy, setIsBuy] = createSignal(true);
	const [size, setSize] = createSignal("");
	const [leverage, setLeverage] = createSignal("10");

	const [submitting, setSubmitting] = createSignal(false);
	const [result, setResult] = createSignal<OrderResult | null>(null);
	const [orderError, setOrderError] = createSignal("");

	const selectedMarket = () =>
		markets().find((m) => m.symbol === coin()) ?? null;

	onMount(async () => {
		try {
			const res = await fetch("/api/hl/markets");
			const data = (await res.json()) as MarketsResponse;
			if (data.error) {
				setLoadError(data.error);
				return;
			}
			setMarkets(data.markets);
			setNetwork(data.network);
			setAddress(data.address);
			if (data.markets.length > 0 && !data.markets.some((m) => m.symbol === coin())) {
				setCoin(data.markets[0].symbol);
			}

			const transport = new WebSocketTransport({
				isTestnet: data.network === "Testnet",
			});
			const client = new SubscriptionClient({ transport });

			let sub: ISubscription | null = null;
			let subscribedCoin = "";

			const subscribeToCoin = (symbol: string) => {
				if (symbol === subscribedCoin || !symbol) return;
				subscribedCoin = symbol;
				sub?.unsubscribe().catch(() => {});
				client
					.activeAssetCtx({ coin: symbol }, (event) => {
						const px = event.ctx?.midPx ?? event.ctx?.markPx;
						if (px !== undefined) {
							setLivePrice(px);
							setFeedLive(true);
						}
					})
					.then((s) => {
						sub = s;
					})
					.catch((e) => {
						subscribedCoin = "";
						setFeedLive(false);
						console.error("Hyperliquid live price feed failed:", e);
					});
			};

			subscribeToCoin(coin());
			createEffect(() => subscribeToCoin(coin()));

			onCleanup(() => {
				sub?.unsubscribe().catch(() => {});
				transport.close();
			});
		} catch (e) {
			setLoadError(e instanceof Error ? e.message : "Failed to load markets");
		}
	});

	const submit = async () => {
		setSubmitting(true);
		setResult(null);
		setOrderError("");
		try {
			const res = await fetch("/api/hl/order", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					coin: coin(),
					isBuy: isBuy(),
					size: size(),
					leverage: leverage(),
				}),
			});
			const data = (await res.json()) as OrderResult;
			if (!res.ok || data.error) {
				setOrderError(data.error ?? "Order failed");
			} else {
				setResult(data);
			}
		} catch (e) {
			setOrderError(e instanceof Error ? e.message : "Network error");
		} finally {
			setSubmitting(false);
		}
	};

	const priceText = () => {
		const raw = livePrice() ?? selectedMarket()?.mid;
		return raw ? `$${Number(raw).toLocaleString()}` : "—";
	};

	const canSubmit = () =>
		!submitting() &&
		markets().length > 0 &&
		coin() !== "" &&
		Number(size()) > 0;

	return (
		<div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
			<Title>Trade | Hyperliquid Terminal</Title>

			<div class="space-y-6">
				<section class="flex items-center justify-between flex-wrap gap-3">
					<div class="flex items-center gap-3">
						<div class="w-1 h-1 rounded-full bg-indigo-500" />
						<h1 class="text-xl font-semibold text-white tracking-tight">
							Hyperliquid Order Terminal
						</h1>
					</div>
					<Show when={network()}>
						<span
							class={`badge-directive ${
								network() === "Testnet"
									? "text-amber-300 border-amber-500/40"
									: "text-rose-300 border-rose-500/40"
							}`}
						>
							{network()} · {address().slice(0, 6)}…{address().slice(-4)}
						</span>
					</Show>
				</section>

				<Show when={loadError()}>
					<div class="directive-card p-4 border-rose-500/30">
						<p class="text-rose-300 text-sm font-mono">{loadError()}</p>
						<p class="text-slate-400 text-xs mt-1">
							Set <span class="font-mono">HL_PRIVATE_KEY</span> in your{" "}
							<span class="font-mono">.env</span> file to enable trading.
						</p>
					</div>
				</Show>

				<Show when={!loadError() && markets().length === 0}>
					<div class="directive-card p-4">
						<p class="text-slate-400 text-sm">Loading markets…</p>
					</div>
				</Show>

				<Show when={!loadError() && markets().length > 0}>
					<div class="directive-card p-5 space-y-5">
						{/* Coin + Price */}
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<label class="block">
								<span class="label-mono text-slate-400">Market</span>
								<select
									class="mt-1 w-full bg-[#0b0e14] border border-white/10 rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:border-indigo-500/60 outline-none"
									value={coin()}
									onChange={(e) => setCoin(e.currentTarget.value)}
								>
									<For each={markets()}>
										{(m) => <option value={m.symbol}>{m.symbol}-USD</option>}
									</For>
								</select>
							</label>

							<div class="block">
								<div class="flex items-center justify-between">
									<span class="label-mono text-slate-400">Last Price</span>
									<Show when={feedLive()}>
										<span class="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald-400/80">
											<span class="relative flex h-1.5 w-1.5">
												<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
												<span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
											</span>
											Live
										</span>
									</Show>
								</div>
								<div class="mt-1 w-full bg-[#0b0e14] border border-white/10 rounded-lg px-3 py-2.5 data-value text-white text-sm tabular-nums">
									{priceText()}
								</div>
							</div>
						</div>

						{/* Side */}
						<div class="grid grid-cols-2 gap-3">
							<button
								type="button"
								onClick={() => setIsBuy(true)}
								class={`py-3 rounded-lg font-bold uppercase tracking-widest text-sm transition-all ${
									isBuy()
										? "bg-emerald-600/30 border border-emerald-500/60 text-emerald-300 shadow-lg shadow-emerald-500/20"
										: "bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200"
								}`}
							>
								Buy / Long
							</button>
							<button
								type="button"
								onClick={() => setIsBuy(false)}
								class={`py-3 rounded-lg font-bold uppercase tracking-widest text-sm transition-all ${
									!isBuy()
										? "bg-rose-600/30 border border-rose-500/60 text-rose-300 shadow-lg shadow-rose-500/20"
										: "bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200"
								}`}
							>
								Sell / Short
							</button>
						</div>

						{/* Size */}
						<label class="block">
							<span class="label-mono text-slate-400">Size ({coin()} units)</span>
							<input
								type="number"
								min="0"
								step="any"
								placeholder="0.00"
								class="mt-1 w-full bg-[#0b0e14] border border-white/10 rounded-lg px-3 py-2.5 text-white font-mono text-sm outline-none focus:border-indigo-500/60"
								value={size()}
								onInput={(e) => setSize(e.currentTarget.value)}
							/>
						</label>

						{/* Leverage */}
						<label class="block">
							<div class="flex items-center justify-between">
								<span class="label-mono text-slate-400">Leverage</span>
								<span class="data-value text-indigo-300 text-sm">{leverage()}x</span>
							</div>
							<input
								type="range"
								min="1"
								max="50"
								class="mt-2 w-full accent-indigo-500"
								value={leverage()}
								onInput={(e) => setLeverage(e.currentTarget.value)}
							/>
						</label>

						{/* Submit */}
						<button
							type="button"
							disabled={!canSubmit()}
							onClick={submit}
							class={`w-full py-3.5 rounded-lg font-bold uppercase tracking-widest text-sm transition-all ${
								canSubmit()
									? isBuy()
										? "bg-linear-to-r from-emerald-600 to-emerald-700 text-white hover:opacity-90 shadow-lg shadow-emerald-500/20"
										: "bg-linear-to-r from-rose-600 to-rose-700 text-white hover:opacity-90 shadow-lg shadow-rose-500/20"
									: "bg-white/5 border border-white/10 text-slate-500 cursor-not-allowed"
							}`}
						>
							{submitting()
								? "Placing order…"
								: `${isBuy() ? "Buy" : "Sell"} ${coin()} @ Market`}
						</button>

						<p class="text-[10px] text-slate-500 leading-relaxed">
							Market orders are executed as aggressive IOC limit orders (1% price
							buffer). Trading involves risk — especially on leverage.
						</p>
					</div>
				</Show>

				{/* Result */}
				<Show when={orderError()}>
					<div class="directive-card p-4 border-rose-500/30">
						<p class="label-mono text-rose-400">Order rejected</p>
						<p class="text-rose-200 text-sm font-mono mt-1">{orderError()}</p>
					</div>
				</Show>

				<Show when={result()?.result?.response?.data?.statuses}>
					<div class="directive-card p-4 border-emerald-500/30">
						<p class="label-mono text-emerald-400">Order result</p>
						<For each={result()!.result!.response!.data!.statuses!}>
							{(s) => {
								if (typeof s === "string") {
									return (
										<div class="mt-2 text-sm font-mono text-slate-400">{s}</div>
									);
								}
								const filled = "filled" in s ? s.filled : null;
								const resting = "resting" in s ? s.resting : null;
								const err = "error" in s ? s.error : null;
								return (
									<div class="mt-2 text-sm font-mono text-slate-200">
										<Show when={filled}>
											<span class="text-emerald-300">
												Filled {Number(filled?.totalSz)} @ {filled?.avgPx}
											</span>
										</Show>
										<Show when={resting}>
											<span class="text-amber-300">
												Resting order #{resting?.oid}
											</span>
										</Show>
										<Show when={err}>
											<span class="text-rose-300">{err}</span>
										</Show>
									</div>
								);
							}}
						</For>
					</div>
				</Show>
			</div>
		</div>
	);
}
