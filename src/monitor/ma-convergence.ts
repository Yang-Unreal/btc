import { and, eq } from "drizzle-orm";
import { ASSET_MAP } from "../lib/constants";
import { assertDb, db } from "../lib/db";
import { priceAlerts } from "../lib/db/schema";

assertDb();

/**
 * BTC 双均线密集监控脚本
 *
 * 监控 BTC/USDT 15分钟周期的6条均线：
 * - SMA 20, 60, 120
 * - EMA 20, 60, 120
 *
 * 当符合以下三大“铁律”时，记录日志：
 * 1. 极值法: 差值 <= 1.5% * 当前价格
 * 2. ATR测算法: 差值 <= 1.5 * 当前15m的ATR(14)
 * 3. 无序交叉法: 均线未处于完美多头或空头排列
 *
 * 使用方式：
 *   bun run src/monitor/ma-convergence.ts
 *
 * 环境变量（在 .env 中配置）：
 *   CHECK_INTERVAL_MS=60000   (可选，默认60秒检查一次)
 */

// ============================================================
// Configuration
// ============================================================

const CHECK_INTERVAL_MS = Number(process.env.CHECK_INTERVAL_MS) || 60_000; // 60s
const COOLDOWN_MS = 15 * 60 * 1000; // 15分钟冷却，避免重复提醒

const SYMBOL = "BTCUSDT";
const GRANULARITY = "15min";
const CANDLE_LIMIT = 200; // 需要足够多的K线来计算MA120

// MA periods to monitor
const MA_PERIODS = [20, 60, 120];

// ============================================================
// Indicator Calculations (reuse the logic from indicators.ts)
// ============================================================

function calculateSMA(closes: number[], period: number): number {
	if (closes.length < period) return NaN;
	const slice = closes.slice(-period);
	return slice.reduce((sum, v) => sum + v, 0) / period;
}

function calculateEMA(closes: number[], period: number): number {
	if (closes.length < period) return NaN;
	const multiplier = 2 / (period + 1);

	// Initial SMA as seed
	let sum = 0;
	for (let i = 0; i < period; i++) {
		sum += closes[i];
	}
	let ema = sum / period;

	// Calculate EMA through all data points
	for (let i = period; i < closes.length; i++) {
		ema = (closes[i] - ema) * multiplier + ema;
	}
	return ema;
}

function calculateATR(
	highs: number[],
	lows: number[],
	closes: number[],
	period: number = 14,
): number {
	if (closes.length < period + 1) return NaN;

	const trs: number[] = [];
	for (let i = 1; i < closes.length; i++) {
		const high = highs[i];
		const low = lows[i];
		const prevClose = closes[i - 1];
		const tr = Math.max(
			high - low,
			Math.abs(high - prevClose),
			Math.abs(low - prevClose),
		);
		trs.push(tr);
	}

	let atr = 0;
	for (let i = 0; i < period; i++) {
		atr += trs[i];
	}
	atr /= period;

	// Wilder's Smoothing
	for (let i = period; i < trs.length; i++) {
		atr = (atr * (period - 1) + trs[i]) / period;
	}

	return atr;
}

// ============================================================
// Hyperliquid API for real-time perpetual price
// ============================================================

async function fetchAllMids(): Promise<Record<string, string> | null> {
	const HL_API = "https://api.hyperliquid.xyz/info";
	try {
		const response = await fetch(HL_API, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ type: "allMids" }),
		});
		if (!response.ok) return null;
		const data = await response.json();
		if (data && typeof data === "object") {
			return data as Record<string, string>;
		}
		return null;
	} catch {
		return null;
	}
}

async function fetchLatestPrice(symbol: string): Promise<number | null> {
	const HL_API = "https://api.hyperliquid.xyz/info";
	const now = Date.now();
	const candidates = [symbol];
	if (symbol.startsWith("xyz:")) {
		candidates.push(symbol.slice(4));
	} else {
		candidates.push(`xyz:${symbol}`);
	}
	for (const coin of candidates) {
		for (let attempt = 1; attempt <= 3; attempt++) {
			try {
				const response = await fetch(HL_API, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						type: "candleSnapshot",
						req: {
							coin,
							interval: "1m",
							startTime: now - 5 * 60 * 1000,
							endTime: now,
						},
					}),
				});
				if (!response.ok) {
					console.error(
						`   candleSnapshot HTTP ${response.status} for ${coin}`,
					);
					continue;
				}
				const data = await response.json();
				if (Array.isArray(data) && data.length > 0) {
					const lastCandle = data[data.length - 1];
					return parseFloat(lastCandle.c);
				}
				console.error(`   candleSnapshot empty data for ${coin}`);
			} catch (e) {
				console.error(
					`   candleSnapshot error for ${coin} (attempt ${attempt}):`,
					e instanceof Error ? e.message : e,
				);
			}
			await new Promise((r) => setTimeout(r, 1000 * attempt));
		}
	}
	return null;
}

// ============================================================
// Bitget API (for historical candles)
// ============================================================

interface BitgetResponse {
	code: string;
	msg: string;
	data: string[][];
}

async function fetchCandles(): Promise<number[][]> {
	const url = `https://api.bitget.com/api/v2/spot/market/candles?symbol=${SYMBOL}&granularity=${GRANULARITY}&limit=${CANDLE_LIMIT}`;

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Bitget API error: ${response.status} ${response.statusText}`,
		);
	}

	const data: BitgetResponse = await response.json();
	if (data.code !== "00000") {
		throw new Error(`Bitget API error: ${data.msg}`);
	}

	// data.data: [[time, open, high, low, close, volume, quoteVol], ...]
	const candles = data.data.map((item: string[]) => [
		parseInt(item[0], 10), // time
		parseFloat(item[1]), // open
		parseFloat(item[2]), // high
		parseFloat(item[3]), // low
		parseFloat(item[4]), // close
		parseFloat(item[5]), // volume
	]);

	// Sort ascending by time
	candles.sort((a: number[], b: number[]) => a[0] - b[0]);
	return candles;
}

// ============================================================
// Core Monitor Logic
// ============================================================

let lastAlertTime = 0;

async function checkPriceAlerts(): Promise<void> {
	const now = new Date();
	const timeStr = now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

	try {
		const allMids = await fetchAllMids();
		if (!allMids) {
			console.log(`[${timeStr}] ⚠️ fetchAllMids returned null`);
			return;
		}

		const alerts = await db
			.select()
			.from(priceAlerts)
			.where(
				and(
					eq(priceAlerts.enabled, "true"),
					eq(priceAlerts.triggered, "false"),
				),
			);

		console.log(`[${timeStr}] 📋 Checking ${alerts.length} active alerts...`);

		for (const alert of alerts) {
			const symbol = alert.symbol || "BTC";
			const hlKey = ASSET_MAP[symbol]?.hlSymbol || symbol;
			let mid = allMids[hlKey];
			let currentPrice: number | null = null;

			if (mid) {
				currentPrice = parseFloat(mid);
				console.log(
					`[${timeStr}] ✅ ${symbol}: mid price = ${currentPrice} (from allMids[${hlKey}])`,
				);
			} else {
				mid = allMids[symbol];
				if (mid) {
					currentPrice = parseFloat(mid);
					console.log(
						`[${timeStr}] ✅ ${symbol}: mid price = ${currentPrice} (from allMids[${symbol}])`,
					);
				} else {
					console.log(
						`[${timeStr}] ⚠️ ${symbol}: not in allMids, trying candleSnapshot...`,
					);
					currentPrice = await fetchLatestPrice(hlKey);
					if (!currentPrice) {
						console.log(
							`[${timeStr}] ⚠️ ${symbol}: no price data available, skipping`,
						);
						continue;
					}
					console.log(
						`[${timeStr}] ✅ ${symbol}: candleSnapshot price = ${currentPrice}`,
					);
				}
			}

			const target = Number(alert.targetPrice);

			const previousPrice = previousPrices[symbol] || 0;
			previousPrices[symbol] = currentPrice;

			const exactMatch = Math.abs(currentPrice - target) <= 0.01;
			const crossedUp =
				previousPrice > 0 && previousPrice < target && currentPrice >= target;
			const crossedDown =
				previousPrice > 0 && previousPrice > target && currentPrice <= target;

			console.log(
				`[${timeStr}] 🔍 ${symbol}: price=${currentPrice}, target=${target}, prev=${previousPrice}, crossedUp=${crossedUp}, crossedDown=${crossedDown}, exactMatch=${exactMatch}`,
			);

			if (exactMatch || crossedUp || crossedDown) {
				console.log(
					`[${timeStr}] 🚀 ${symbol} alert condition met, updating DB...`,
				);
				await db
					.update(priceAlerts)
					.set({ triggered: "true", enabled: "false", updatedAt: new Date() })
					.where(eq(priceAlerts.id, alert.id));

				console.log(`[${timeStr}] 🔔 价格提醒触发: ${symbol} $${target}`);
			}
		}
	} catch (e) {
		console.error("Failed to check price alerts:", e);
	}
}

const previousPrices: Record<string, number> = {};

async function runMonitorCycle() {
	const timeStr = new Date().toLocaleString("zh-CN", {
		timeZone: "Asia/Shanghai",
	});

	try {
		const candles = await fetchCandles();
		if (candles.length >= 120) {
			const highs = candles.map((c) => c[2]);
			const lows = candles.map((c) => c[3]);
			const closes = candles.map((c) => c[4]);
			await processMAConvergence(
				highs,
				lows,
				closes,
				closes[closes.length - 1],
			);
		} else {
			console.log(
				`[${timeStr}] ⚠️  K线数据不足 (${candles.length}/120)，跳过均线分析`,
			);
		}
	} catch (e) {
		console.error(`[${timeStr}] ❌ 均线分析异常:`, e);
	}

	try {
		await checkPriceAlerts();
	} catch (e) {
		console.error(`[${timeStr}] ❌ 价格提醒检查异常:`, e);
	}
}

async function processMAConvergence(
	highs: number[],
	lows: number[],
	closes: number[],
	currentPrice: number,
) {
	// Calculate all 6 moving averages
	const maValues: { name: string; value: number }[] = [];
	for (const period of MA_PERIODS) {
		const sma = calculateSMA(closes, period);
		const ema = calculateEMA(closes, period);
		if (!Number.isNaN(sma)) maValues.push({ name: `SMA${period}`, value: sma });
		if (!Number.isNaN(ema)) maValues.push({ name: `EMA${period}`, value: ema });
	}

	if (maValues.length < 6) return;

	const values = maValues.map((m) => m.value);
	const maxMa = Math.max(...values);
	const minMa = Math.min(...values);
	const spread = maxMa - minMa;

	const atr = calculateATR(highs, lows, closes, 14);
	if (Number.isNaN(atr)) return;

	// 1. 百分比极值法
	const spreadPercent = (spread / currentPrice) * 100;
	const passedRule1 = spreadPercent <= 1.5;

	// 2. ATR 波动率测算法
	const passedRule2 = spread <= 1.5 * atr;

	// 3. 无序交叉法 (Spaghetti Test)
	const sma20 = maValues.find((m) => m.name === "SMA20")?.value || 0;
	const ema20 = maValues.find((m) => m.name === "EMA20")?.value || 0;
	const sma60 = maValues.find((m) => m.name === "SMA60")?.value || 0;
	const ema60 = maValues.find((m) => m.name === "EMA60")?.value || 0;
	const sma120 = maValues.find((m) => m.name === "SMA120")?.value || 0;
	const ema120 = maValues.find((m) => m.name === "EMA120")?.value || 0;

	const isBullishOrdered =
		Math.min(sma20, ema20) > Math.max(sma60, ema60) &&
		Math.min(sma60, ema60) > Math.max(sma120, ema120);
	const isBearishOrdered =
		Math.max(sma20, ema20) < Math.min(sma60, ema60) &&
		Math.max(sma60, ema60) < Math.min(sma120, ema120);
	const passedRule3 = !isBullishOrdered && !isBearishOrdered;

	if (passedRule1 && passedRule2 && passedRule3) {
		const nowMs = Date.now();
		if (nowMs - lastAlertTime < COOLDOWN_MS) return;

		lastAlertTime = nowMs;
		const maDetails = maValues
			.sort((a, b) => b.value - a.value)
			.map((m) => `  ${m.name}: $${m.value.toFixed(2)}`)
			.join("\n");

		console.log(
			[
				"🚨 <b>15分钟 均线绝对纠缠触发!</b> 🚨",
				"",
				`💰 当前价格: <b>$${currentPrice.toFixed(2)}</b>`,
				`📏 均线价差: <b>$${spread.toFixed(2)}</b> (<b>${spreadPercent.toFixed(2)}%</b>)`,
				`🌪️ 15M ATR(14): <b>$${atr.toFixed(2)}</b>`,
				"",
				"✅ 满足所有三大铁律:",
				"1. 1.5% 极限压缩",
				"2. 价差 < 1.5 * ATR",
				"3. 意大利面无序缠绕",
				"",
				"📈 当前均线值:",
				maDetails,
				"",
				"🚀 注意：可能即将出现剧烈波动，请密切关注！",
			].join("\n"),
		);
	}
}

// ============================================================
// Main Entry Point
// ============================================================

export async function startMAMonitor() {
	// 立即执行一次
	await runMonitorCycle();
	// 设置循环
	setInterval(runMonitorCycle, CHECK_INTERVAL_MS);
}

export async function startPriceAlertMonitor() {
	// 立即执行一次
	await checkPriceAlerts();
	// 设置循环（价格提醒更频繁一些）
	setInterval(checkPriceAlerts, Math.min(CHECK_INTERVAL_MS, 60_000));
}

// 兼容直接运行和模块导入
if (import.meta.url.includes(process.argv[1])) {
	startMAMonitor().catch(console.error);
}
