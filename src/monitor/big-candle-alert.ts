import type { Interval } from "../lib/types";

const HL_API = "https://api.hyperliquid.xyz/info";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const SYMBOL = process.env.BIG_CANDLE_SYMBOL || "BTC";
const MULTIPLIER = Number.parseFloat(process.env.BIG_CANDLE_MULTIPLIER || "2");
const COMPARE_CANDLES = Number.parseInt(
	process.env.BIG_CANDLE_COMPARE || "3",
	10,
);
const ALERT_COOLDOWN_MS = Number.parseInt(
	process.env.BIG_CANDLE_COOLDOWN_MS || "0",
	10,
);

const TIMEFRAMES = (process.env.BIG_CANDLE_TIMEFRAMES || "5m,15m,1h,4h,1d")
	.split(",")
	.map((s) => s.trim())
	.filter(Boolean) as Interval[];

interface HLCandle {
	t: number;
	T: number;
	o: string;
	c: string;
	h: string;
	l: string;
	v: string;
}

interface Candle {
	ts: number;
	closeTime: number;
	open: number;
	close: number;
	body: number;
}

interface TimeframeState {
	closedCandles: Candle[];
	initialized: boolean;
	lastAlertAt: number;
}

function intervalToMs(interval: string): number {
	const num = Number.parseFloat(interval);
	if (Number.isNaN(num)) return 60_000;
	if (interval.endsWith("m")) return num * 60_000;
	if (interval.endsWith("h")) return num * 3_600_000;
	if (interval.endsWith("d")) return num * 86_400_000;
	if (interval.endsWith("w")) return num * 604_800_000;
	if (interval.endsWith("M")) return num * 2_592_000_000;
	return num * 60_000;
}

function pollIntervalFor(interval: string): number {
	const ms = intervalToMs(interval);
	return Math.min(Math.max(ms / 3, 30_000), 300_000);
}

const states: Record<string, TimeframeState> = {};

for (const tf of TIMEFRAMES) {
	states[tf] = {
		closedCandles: [],
		initialized: false,
		lastAlertAt: 0,
	};
}

async function fetchCandles(
	symbol: string,
	interval: string,
	limit = 8,
): Promise<Candle[]> {
	const intervalMs = intervalToMs(interval);
	const now = Date.now();
	const startTime = now - intervalMs * limit;

	const res = await fetch(HL_API, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			type: "candleSnapshot",
			req: { coin: symbol, interval, startTime, endTime: now },
		}),
	});

	if (!res.ok) return [];

	const raw: unknown = await res.json();
	if (!Array.isArray(raw)) return [];

	return (raw as HLCandle[])
		.map((c): Candle => {
			const open = parseFloat(c.o);
			const close = parseFloat(c.c);
			return {
				ts: Math.floor(c.t / 1000),
				closeTime: c.T,
				open,
				close,
				body: Math.abs(close - open),
			};
		})
		.sort((a, b) => a.ts - b.ts);
}

async function sendTelegramMessage(message: string): Promise<void> {
	if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
		console.log("[big-candle] Telegram not configured, skipping");
		return;
	}

	const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				chat_id: TELEGRAM_CHAT_ID,
				text: message,
				parse_mode: "HTML",
			}),
		});
		const text = await res.text();
		if (!res.ok) {
			console.error(
				"[big-candle] Telegram error:",
				res.status,
				text.slice(0, 200),
			);
		}
	} catch (e) {
		console.error("[big-candle] Telegram error:", e);
	}
}

function candlePercent(candle: Candle): number {
	return (candle.body / candle.open) * 100;
}

async function evaluateCandle(tf: string, candle: Candle): Promise<void> {
	const state = states[tf];
	const prev = state.closedCandles.filter((c) => c.ts < candle.ts);
	if (prev.length < COMPARE_CANDLES) return;

	const recent = prev.slice(-COMPARE_CANDLES);
	const avgBody = recent.reduce((sum, c) => sum + c.body, 0) / COMPARE_CANDLES;
	if (avgBody <= 0) return;

	const ratio = candle.body / avgBody;
	if (ratio < MULTIPLIER) return;

	const now = Date.now();
	if (now - state.lastAlertAt < ALERT_COOLDOWN_MS) {
		console.log(`[big-candle] ${tf} ${SYMBOL} on cooldown, skipping`);
		return;
	}
	state.lastAlertAt = now;

	const direction =
		candle.close > candle.open ? "🔼 上升 (看涨)" : "🔽 下落 (看跌)";
	const closeTimeStr = new Date(candle.closeTime).toLocaleString("zh-CN", {
		timeZone: "Asia/Shanghai",
	});
	const recentStr = recent
		.map((c) => `${candlePercent(c).toFixed(2)}%`)
		.join(" / ");
	const avgPct = ((avgBody / recent[0].open) * 100).toFixed(2);

	await sendTelegramMessage(
		[
			`🍯 <b>${SYMBOL} ${tf} 大蜡烛信号</b>`,
			"",
			`⏰ 时间: ${closeTimeStr}`,
			`📊 方向: ${direction}`,
			`💥 实体范围: ${candle.body.toFixed(2)}  (O: $${candle.open.toFixed(2)} → C: $${candle.close.toFixed(2)})`,
			`📏 实体占比: ${candlePercent(candle).toFixed(2)}%`,
			`📈 前${COMPARE_CANDLES}根平均实体: ${avgPct}%  (逐根: ${recentStr})`,
			`⚡ 放大倍数: <b>${ratio.toFixed(2)}x</b> (阈值: ${MULTIPLIER}x)`,
			"",
			`🚀 当前K线实体是前${COMPARE_CANDLES}根的 <b>${ratio.toFixed(2)}x</b>，显著放大！`,
		].join("\n"),
	);
	console.log(
		`[big-candle] ${tf} ${SYMBOL} ALERT sent: body ${ratio.toFixed(2)}x avg`,
	);
}

async function checkTimeframe(tf: string): Promise<void> {
	const state = states[tf];
	const now = Date.now();

	let candles: Candle[];
	try {
		candles = await fetchCandles(SYMBOL, tf);
	} catch (e) {
		console.error(`[big-candle] ${tf} fetch error:`, e);
		return;
	}

	if (candles.length === 0) {
		console.log(`[big-candle] ${tf} no candles returned`);
		return;
	}

	// Only candles whose close time has fully passed are "closed".
	const closed = candles.filter((c) => c.closeTime <= now);
	if (closed.length === 0) return;

	const known = new Set(state.closedCandles.map((c) => c.ts));
	const newClosed = closed.filter((c) => !known.has(c.ts));

	const merged = [...state.closedCandles, ...newClosed].sort(
		(a, b) => a.ts - b.ts,
	);
	const seen = new Set<number>();
	const deduped = merged.filter((c) => {
		if (seen.has(c.ts)) return false;
		seen.add(c.ts);
		return true;
	});
	const bufferSize = Math.max(12, COMPARE_CANDLES + 4);
	state.closedCandles = deduped.slice(-bufferSize);

	if (!state.initialized) {
		state.initialized = true;
		console.log(
			`[big-candle] ${tf} ${SYMBOL} baseline: ${state.closedCandles.length} closed candles (last ts ${state.closedCandles.at(-1)?.ts})`,
		);
		return;
	}

	for (const nc of newClosed) {
		await evaluateCandle(tf, nc);
	}
}

let started = false;

export function startBigCandleMonitor(): void {
	if (started) return;
	started = true;
	for (const tf of TIMEFRAMES) {
		const pollMs = pollIntervalFor(tf);
		console.log(
			`[big-candle] ${SYMBOL} ${tf}: polling every ${Math.round(pollMs / 1000)}s (multiplier=${MULTIPLIER}x, compare=${COMPARE_CANDLES})`,
		);
		checkTimeframe(tf).catch((e) =>
			console.error(`[big-candle] ${tf} initial check error:`, e),
		);
		setInterval(() => {
			checkTimeframe(tf).catch((e) =>
				console.error(`[big-candle] ${tf} check error:`, e),
			);
		}, pollMs);
	}
}

startBigCandleMonitor();
