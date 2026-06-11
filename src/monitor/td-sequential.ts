import { eq } from "drizzle-orm";
import { assertDb, db } from "../lib/db";
import { userSettings } from "../lib/db/schema";

assertDb();

/**
 * TD Sequential 监控脚本 - 多时间框架
 *
 * 支持的时间框架: 15m, 1h, 4h, 1d
 *
 * 触发条件：
 *  - Bullish setup 9
 *  - Bearish setup 9
 *  - Buy countdown 13
 *  - Sell countdown 13
 *
 * 通过 Telegram Bot 发送提醒。
 *
 * 运行方式：
 *   bun run src/monitor/td-sequential.ts
 *
 * 环境变量：
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_ID
 *   TD_SEQ_CHECK_INTERVAL_MS (可选，默认 60000)
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const CHECK_INTERVAL_MS =
	Number(process.env.TD_SEQ_CHECK_INTERVAL_MS) || 60_000;
const SYMBOL = "BTCUSDT";
const CANDLE_LIMIT = 200;

type Granularity = "15min" | "1h" | "4h" | "1d";

interface MonitorConfig {
	granularity: Granularity;
	displayName: string;
}

interface BitgetResponse {
	code: string;
	msg: string;
	data: string[][];
}

type TDSequentialEventType =
	| "bullish-setup-9"
	| "bearish-setup-9"
	| "buy-countdown-13"
	| "sell-countdown-13";

interface TDSequentialEvent {
	time: number;
	type: TDSequentialEventType;
	description: string;
}

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

async function fetchCandles(granularity: Granularity): Promise<number[][]> {
	const url = `https://api.bitget.com/api/v2/spot/market/candles?symbol=${SYMBOL}&granularity=${granularity}&limit=${CANDLE_LIMIT}`;
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

	return data.data
		.map((item) => [
			parseInt(item[0], 10),
			parseFloat(item[1]),
			parseFloat(item[2]),
			parseFloat(item[3]),
			parseFloat(item[4]),
			parseFloat(item[5]),
		])
		.sort((a, b) => a[0] - b[0]);
}

function calculateTDSequentialEvents(
	data: number[][],
	timeframe: string = "candle",
): TDSequentialEvent[] {
	const events: TDSequentialEvent[] = [];
	let buySetup = 0;
	let sellSetup = 0;
	let activeBuyCountdown = false;
	let activeSellCountdown = false;
	let buyCountdown = 0;
	let sellCountdown = 0;

	for (let i = 4; i < data.length; i++) {
		const currentClose = data[i][4];
		const closeLag4 = data[i - 4][4];
		const lowLag2 = data[i - 2][3];
		const highLag2 = data[i - 2][2];
		const time = data[i][0];

		if (currentClose < closeLag4) {
			buySetup += 1;
			sellSetup = 0;
		} else if (currentClose > closeLag4) {
			sellSetup += 1;
			buySetup = 0;
		} else {
			buySetup = 0;
			sellSetup = 0;
		}

		if (buySetup === 9) {
			events.push({
				time,
				type: "bullish-setup-9",
				description: `Bullish TD Sequential setup 9: ${timeframe} close < 4 bars ago close`,
			});
			activeBuyCountdown = true;
			activeSellCountdown = false;
			buyCountdown = 0;
			sellSetup = 0;
			buySetup = 0;
		}

		if (sellSetup === 9) {
			events.push({
				time,
				type: "bearish-setup-9",
				description: `Bearish TD Sequential setup 9: ${timeframe} close > 4 bars ago close`,
			});
			activeSellCountdown = true;
			activeBuyCountdown = false;
			sellCountdown = 0;
			buySetup = 0;
			sellSetup = 0;
		}

		if (activeBuyCountdown && currentClose <= lowLag2) {
			buyCountdown += 1;
			if (buyCountdown === 13) {
				events.push({
					time,
					type: "buy-countdown-13",
					description: `TD Sequential buy countdown 13: ${timeframe} close <= low 2 bars ago`,
				});
				activeBuyCountdown = false;
				buyCountdown = 0;
			}
		}

		if (activeSellCountdown && currentClose >= highLag2) {
			sellCountdown += 1;
			if (sellCountdown === 13) {
				events.push({
					time,
					type: "sell-countdown-13",
					description: `TD Sequential sell countdown 13: ${timeframe} close >= high 2 bars ago`,
				});
				activeSellCountdown = false;
				sellCountdown = 0;
			}
		}
	}

	return events;
}

// 为每个时间框架维护独立的追踪状态
const monitorState: Record<
	Granularity,
	{ lastProcessedTime: number; notifiedEvents: Set<string> }
> = {
	"15min": { lastProcessedTime: 0, notifiedEvents: new Set() },
	"1h": { lastProcessedTime: 0, notifiedEvents: new Set() },
	"4h": { lastProcessedTime: 0, notifiedEvents: new Set() },
	"1d": { lastProcessedTime: 0, notifiedEvents: new Set() },
};

function formatEventMessage(
	event: TDSequentialEvent,
	price: number,
	displayName: string,
): string {
	const dt = new Date(event.time).toLocaleString("zh-CN", {
		timeZone: "Asia/Shanghai",
		hour12: false,
	});
	const title =
		event.type === "bullish-setup-9"
			? `🟩 TD Sequential ${displayName} Bullish Setup 9`
			: event.type === "bearish-setup-9"
				? `🟥 TD Sequential ${displayName} Bearish Setup 9`
				: event.type === "buy-countdown-13"
					? `🟦 TD Sequential ${displayName} Buy Countdown 13`
					: `🟧 TD Sequential ${displayName} Sell Countdown 13`;

	return [
		`${title}`,
		"",
		`⏰ K线时间: ${dt}`,
		`💰 当前价格: <b>$${price.toFixed(2)}</b>`,
		`📌 触发类型: ${event.description}`,
		"",
		`请查看 ${displayName} 图表，并根据风险制定交易计划。`,
	].join("\n");
}

async function shouldNotify(): Promise<boolean> {
	const settings = await db
		.select()
		.from(userSettings)
		.where(eq(userSettings.id, "default"));

	if (settings.length === 0) return true;
	return settings[0].notificationsEnabled !== "false";
}

async function runMonitorCycle(
	config: MonitorConfig,
): Promise<void> {
	try {
		if (!(await shouldNotify())) return;

		const candles = await fetchCandles(config.granularity);
		if (candles.length < 20) return;

		const events = calculateTDSequentialEvents(candles, config.displayName);
		if (events.length === 0) {
			monitorState[config.granularity].lastProcessedTime =
				candles[candles.length - 1][0];
			return;
		}

		const latestCandleTime = candles[candles.length - 1][0];
		const currentPrice = candles[candles.length - 1][4];
		const state = monitorState[config.granularity];

		const newEvents = events.filter((event) => {
			if (state.lastProcessedTime === 0) {
				return event.time === latestCandleTime;
			}
			return event.time > state.lastProcessedTime;
		});

		for (const event of newEvents) {
			const eventKey = `${event.time}-${event.type}`;
			if (state.notifiedEvents.has(eventKey)) continue;

			state.notifiedEvents.add(eventKey);
			await sendTelegramMessage(
				formatEventMessage(event, currentPrice, config.displayName),
			);
		}

		state.lastProcessedTime = latestCandleTime;
	} catch (error) {
		console.error(
			`❌ TD Sequential 监控异常 (${config.displayName}):`,
			error,
		);
	}
}

export async function startTDSequentialMonitor(): Promise<void> {
	if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
		console.log(
			"⚠️ TD Sequential Monitoring NOT started: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing.",
		);
		return;
	}

	const configs: MonitorConfig[] = [
		{ granularity: "15min", displayName: "15m" },
		{ granularity: "1h", displayName: "1h" },
		{ granularity: "4h", displayName: "4h" },
		{ granularity: "1d", displayName: "1d" },
	];

	console.log(
		"✅ TD Sequential Monitoring started for: 15m, 1h, 4h, 1d",
	);

	// 立即运行所有时间框架的第一次检查
	for (const config of configs) {
		await runMonitorCycle(config);
	}

	// 为每个时间框架设置定时检查
	for (const config of configs) {
		setInterval(() => runMonitorCycle(config), CHECK_INTERVAL_MS);
	}
}

if (import.meta.url.includes(process.argv[1])) {
	startTDSequentialMonitor().catch(console.error);
}
