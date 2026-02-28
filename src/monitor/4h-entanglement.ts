import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { userSettings } from "../lib/db/schema";

/**
 * BTC 4H 均线绝对纠缠监控脚本
 *
 * 这套系统基于"双均线趋势破位系统"的三大铁律：
 * 1. 百分比极值法 (The 1.5% Rule): 6条均线（MA/EMA的20,60,120）的最大差值 <= 1.5%
 * 2. ATR 波动率测算法 (The ATR Filter): 6条线差值 <= 1.5 * 当前4H的ATR(14)
 * 3. 无序交叉法则 (The Spaghetti Test): 它们不能呈完美的多头/空头排列
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
// Alternatively, check more frequently, e.g., every 5 mins, since 4H close changes
const ACTUAL_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 mins
const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours cooldown after alert

const SYMBOL = "BTCUSDT";
const GRANULARITY = "4h";
const CANDLE_LIMIT = 200;

// ============================================================
// Indicator Calculations
// ============================================================

function calculateSMA(closes: number[], period: number): number {
	if (closes.length < period) return NaN;
	const slice = closes.slice(-period);
	return slice.reduce((sum, v) => sum + v, 0) / period;
}

function calculateEMA(closes: number[], period: number): number {
	if (closes.length < period) return NaN;
	const multiplier = 2 / (period + 1);

	let sum = 0;
	for (let i = 0; i < period; i++) {
		sum += closes[i];
	}
	let ema = sum / period;

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

	for (let i = period; i < trs.length; i++) {
		atr = (atr * (period - 1) + trs[i]) / period;
	}

	return atr;
}

// ============================================================
// Bitget API
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

	const candles = data.data.map((item: string[]) => [
		parseInt(item[0]), // time
		parseFloat(item[1]), // open
		parseFloat(item[2]), // high
		parseFloat(item[3]), // low
		parseFloat(item[4]), // close
		parseFloat(item[5]), // volume
	]);

	candles.sort((a, b) => a[0] - b[0]);
	return candles;
}

// ============================================================
// Telegram Notification
// ============================================================

async function sendTelegramMessage(message: string): Promise<void> {
	if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

	const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
	try {
		await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				chat_id: TELEGRAM_CHAT_ID,
				text: message,
				parse_mode: "HTML",
			}),
		});
	} catch (error) {
		console.error("❌ Telegram 发送异常:", error);
	}
}

// ============================================================
// Core Logic
// ============================================================

let lastAlertTime = 0;

async function runMonitorCycle() {
	const now = new Date();
	const timeStr = now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

	try {
		// 先检查配置是否开启
		const settings = await db
			.select()
			.from(userSettings)
			.where(eq(userSettings.id, "default"));

		if (settings.length > 0 && settings[0].fourHAlertEnabled === "false") {
			return;
		}

		const candles = await fetchCandles();
		if (candles.length < 120) return;

		const highs = candles.map((c) => c[2]);
		const lows = candles.map((c) => c[3]);
		const closes = candles.map((c) => c[4]);
		const currentPrice = closes[closes.length - 1];

		const sma20 = calculateSMA(closes, 20);
		const ema20 = calculateEMA(closes, 20);
		const sma60 = calculateSMA(closes, 60);
		const ema60 = calculateEMA(closes, 60);
		const sma120 = calculateSMA(closes, 120);
		const ema120 = calculateEMA(closes, 120);

		if (Number.isNaN(sma120) || Number.isNaN(ema120)) return;

		const atr = calculateATR(highs, lows, closes, 14);

		const values = [sma20, ema20, sma60, ema60, sma120, ema120];
		const maxMa = Math.max(...values);
		const minMa = Math.min(...values);
		const spread = maxMa - minMa;

		// Iron Rule 1: The 1.5% Rule
		const spreadPercent = (spread / currentPrice) * 100;
		const passedRule1 = spreadPercent <= 1.5;

		// Iron Rule 2: The ATR Filter
		const passedRule2 = spread <= 1.5 * atr;

		// Iron Rule 3: The Spaghetti Test
		// Not ordered perfectly bullish or bearish
		const isBullishOrdered =
			Math.min(sma20, ema20) > Math.max(sma60, ema60) &&
			Math.min(sma60, ema60) > Math.max(sma120, ema120);
		const isBearishOrdered =
			Math.max(sma20, ema20) < Math.min(sma60, ema60) &&
			Math.max(sma60, ema60) < Math.min(sma120, ema120);
		const passedRule3 = !isBullishOrdered && !isBearishOrdered;

		console.log(
			`[${timeStr}] 4H BTC: $${currentPrice.toFixed(2)} | Diff: $${spread.toFixed(2)} (${spreadPercent.toFixed(2)}%) | ATR: $${atr.toFixed(2)} | R1:${passedRule1} R2:${passedRule2} R3:${passedRule3}`,
		);

		if (passedRule1 && passedRule2 && passedRule3) {
			const nowMs = Date.now();
			if (nowMs - lastAlertTime < COOLDOWN_MS) return;

			lastAlertTime = nowMs;

			await sendTelegramMessage(
				[
					"🚨 <b>4H 均线绝对纠缠触发!</b> 🚨",
					"",
					`💰 当前价格: <b>$${currentPrice.toFixed(2)}</b>`,
					`📏 均线价差: <b>$${spread.toFixed(2)}</b> (<b>${spreadPercent.toFixed(2)}%</b>)`,
					`🌪️ 4H ATR(14): <b>$${atr.toFixed(2)}</b>`,
					"",
					"✅ 满足所有三大铁律:",
					"1. 1.5% 极限压缩",
					"2. 价差 < 1.5 * ATR",
					"3. 意大利面无序缠绕",
					"",
					"🚀 随时可能引爆单边海啸，请密切关注！",
				].join("\n"),
			);
		}
	} catch (e) {
		console.error(`[${timeStr}] ❌ 4H 监控异常:`, e);
	}
}

export async function start4HMonitor() {
	if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
		console.log(
			"⚠️ 4H Monitoring NOT started: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing.",
		);
		return;
	}

	console.log("=".repeat(60));
	console.log("🔍 BTC 4H 均线绝对纠缠监控后台服务启动");
	console.log("=".repeat(60));

	await runMonitorCycle();
	setInterval(runMonitorCycle, ACTUAL_CHECK_INTERVAL_MS);
}

if (import.meta.url.includes(process.argv[1])) {
	start4HMonitor().catch(console.error);
}
