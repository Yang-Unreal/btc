import { and, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { priceAlerts, userSettings } from "../lib/db/schema";

/**
 * BTC 双均线密集监控脚本
 *
 * 监控 BTC/USDT 15分钟周期的6条均线：
 * - SMA 20, 60, 120
 * - EMA 20, 60, 120
 *
 * 当6条均线最大值与最小值差距 ≤ 300 USDT 时，
 * 通过 Telegram Bot 发送提醒。
 *
 * 使用方式：
 *   bun run src/monitor/ma-convergence.ts
 *
 * 环境变量（在 .env 中配置）：
 *   TELEGRAM_BOT_TOKEN=你的bot token
 *   TELEGRAM_CHAT_ID=你的chat id
 *   MA_THRESHOLD=300          (可选，默认300)
 *   CHECK_INTERVAL_MS=60000   (可选，默认60秒检查一次)
 */

// ============================================================
// Configuration
// ============================================================

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const MA_THRESHOLD = Number(process.env.MA_THRESHOLD) || 300;
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

	// data.data: [[time, open, high, low, close, volume, quoteVol], ...]
	const candles = data.data.map((item: string[]) => [
		parseInt(item[0]), // time
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
// Telegram Notification
// ============================================================

async function sendTelegramMessage(message: string): Promise<void> {
	if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
		console.error(
			"❌ Telegram 配置缺失！请设置 TELEGRAM_BOT_TOKEN 和 TELEGRAM_CHAT_ID",
		);
		return;
	}

	const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				chat_id: TELEGRAM_CHAT_ID,
				text: message,
				parse_mode: "HTML",
			}),
		});

		if (!response.ok) {
			const errorData = await response.text();
			console.error("❌ Telegram 发送失败:", errorData);
		} else {
			console.log("✅ Telegram 消息已发送");
		}
	} catch (error) {
		console.error("❌ Telegram 发送异常:", error);
	}
}

// ============================================================
// Core Monitor Logic
// ============================================================

let lastAlertTime = 0;

async function checkPriceAlerts(currentPrice: number): Promise<void> {
	const now = new Date();
	const timeStr = now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

	try {
		// Fetch enabled and non-triggered alerts
		const alerts = await db
			.select()
			.from(priceAlerts)
			.where(
				and(
					eq(priceAlerts.enabled, "true"),
					eq(priceAlerts.triggered, "false"),
				),
			);

		for (const alert of alerts) {
			const target = Number(alert.targetPrice);

			// Simple "equals or crossed" logic
			// Since we check every minute, we check if price is "very close" or crossed
			// But to be simple and reliable: if it was below and now above, or vice versa
			// For this implementation, we'll just check if it's within a tiny margin (0.1%) or crossed
			// Actually, let's keep it simple: if currentPrice is within $50 of target, trigger.
			// Better: if it's the first time we see it hit the target.

			const margin = 50; // $50 tolerance for 1-minute checks
			if (Math.abs(currentPrice - target) <= margin) {
				// TRIGGER!
				await sendTelegramMessage(
					[
						"🔔 <b>BTC 价格提醒触发</b> 🔔",
						"",
						`⏰ 时间: ${timeStr}`,
						`💰 当前价格: <b>$${currentPrice.toFixed(2)}</b>`,
						`🎯 目标价格: <b>$${target.toFixed(2)}</b>`,
						"",
						"🚀 价格已达到您的预设目标！",
					].join("\n"),
				);

				// Mark as triggered and disable to avoid spam
				await db
					.update(priceAlerts)
					.set({ triggered: "true", enabled: "false", updatedAt: new Date() })
					.where(eq(priceAlerts.id, alert.id));

				console.log(`[${timeStr}] 🔔 价格提醒触发: $${target}`);
			}
		}
	} catch (e) {
		console.error("Failed to check price alerts:", e);
	}
}

async function runMonitorCycle() {
	const now = new Date();
	const timeStr = now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

	try {
		const candles = await fetchCandles();
		if (candles.length < 120) {
			console.log(`[${timeStr}] ⚠️ 数据不足，跳过本轮`);
			return;
		}

		const closes = candles.map((c) => c[4]);
		const currentPrice = closes[closes.length - 1];

		// 1. Check MA Convergence
		await processMAConvergence(closes, currentPrice, timeStr);

		// 2. Check Price Alerts
		await checkPriceAlerts(currentPrice);
	} catch (e) {
		console.error(`[${timeStr}] ❌ 监控周期异常:`, e);
	}
}

async function processMAConvergence(
	closes: number[],
	currentPrice: number,
	timeStr: string,
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
	const spread = Math.max(...values) - Math.min(...values);

	console.log(
		`[${timeStr}] BTC: $${currentPrice.toFixed(2)} | 均线差: $${spread.toFixed(2)}`,
	);

	if (spread <= MA_THRESHOLD) {
		const nowMs = Date.now();
		if (nowMs - lastAlertTime < COOLDOWN_MS) return;

		// Check if global notifications are enabled
		const settings = await db
			.select()
			.from(userSettings)
			.where(eq(userSettings.id, "default"));
		if (settings.length > 0 && settings[0].notificationsEnabled === "false")
			return;

		lastAlertTime = nowMs;
		const maDetails = maValues
			.sort((a, b) => b.value - a.value)
			.map((m) => `  ${m.name}: $${m.value.toFixed(2)}`)
			.join("\n");

		await sendTelegramMessage(
			[
				"🚨 <b>BTC 均线密集提醒</b> 🚨",
				"",
				`💰 当前价格: <b>$${currentPrice.toFixed(2)}</b>`,
				`📏 均线价差: <b>$${spread.toFixed(2)}</b>`,
				"",
				"📈 均线值:",
				maDetails,
			].join("\n"),
		);
	}
}

// ============================================================
// Main Entry Point
// ============================================================

export async function startMAMonitor() {
	if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
		console.log(
			"⚠️  Monitoring NOT started: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.",
		);
		return;
	}

	console.log("=".repeat(60));
	console.log("🔍 BTC 双均线密集监控后台服务启动");
	console.log(
		`  均线差阈值: $${MA_THRESHOLD} | 检查间隔: ${CHECK_INTERVAL_MS / 1000}秒`,
	);
	console.log("=".repeat(60));

	// 立即执行一次
	await runMonitorCycle();
	// 设置循环
	setInterval(runMonitorCycle, CHECK_INTERVAL_MS);
}

// 兼容直接运行和模块导入
if (import.meta.url.includes(process.argv[1])) {
	startMAMonitor().catch(console.error);
}
