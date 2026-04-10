import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { userSettings } from "../lib/db/schema";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

interface BTCData {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume?: number;
}

async function sendTelegramMessage(message: string): Promise<void> {
	if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
		console.error(
			"❌ Telegram 配置缺失！请设置 TELEGRAM_BOT_TOKEN 和 TELELEGRAM_CHAT_ID",
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

function calculateEMA(data: number[], period: number): number[] {
	const ema: number[] = [];
	const multiplier = 2 / (period + 1);

	for (let i = 0; i < data.length; i++) {
		if (i === 0) {
			ema.push(data[i]);
		} else {
			ema.push(data[i] * multiplier + ema[i - 1] * (1 - multiplier));
		}
	}
	return ema;
}

function calculateRSI(data: number[], period: number = 14): number[] {
	const rsi: number[] = [];
	const gains: number[] = [];
	const losses: number[] = [];

	for (let i = 1; i < data.length; i++) {
		const change = data[i] - data[i - 1];
		gains.push(change > 0 ? change : 0);
		losses.push(change < 0 ? -change : 0);
	}

	for (let i = 0; i < gains.length; i++) {
		if (i < period) {
			rsi.push(50);
			continue;
		}

		const avgGain =
			gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
		const avgLoss =
			losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;

		if (avgLoss === 0) {
			rsi.push(100);
		} else {
			const rs = avgGain / avgLoss;
			rsi.push(100 - 100 / (1 + rs));
		}
	}

	return [50, ...rsi];
}

function calculateMACD(data: number[]): { macd: number[]; signal: number[] } {
	const ema12 = calculateEMA(data, 12);
	const ema26 = calculateEMA(data, 26);
	const macdLine = ema12.map((v, i) => v - ema26[i]);
	const signalLine = calculateEMA(macdLine, 9);
	return { macd: macdLine, signal: signalLine };
}

function calculateVWAP(data: BTCData[]): number[] {
	const vwap: number[] = [];
	let cumulativeTPV = 0;
	let cumulativeV = 0;

	for (let i = 0; i < data.length; i++) {
		const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
		const volume = data[i].volume || 1;
		cumulativeTPV += typicalPrice * volume;
		cumulativeV += volume;
		vwap.push(cumulativeTPV / cumulativeV);
	}
	return vwap;
}

function calculateVolumeAvg(data: BTCData[], period: number = 20): number[] {
	const avg: number[] = [];
	for (let i = 0; i < data.length; i++) {
		if (i < period - 1) {
			const sum = data
				.slice(0, i + 1)
				.reduce((acc, d) => acc + (d.volume || 0), 0);
			avg.push(sum / (i + 1));
		} else {
			const sum = data
				.slice(i - period + 1, i + 1)
				.reduce((acc, d) => acc + (d.volume || 0), 0);
			avg.push(sum / period);
		}
	}
	return avg;
}

function calculateADX(data: BTCData[], period: number = 14): number[] {
	const adx: number[] = [];
	const plusDM: number[] = [];
	const minusDM: number[] = [];
	const tr: number[] = [];

	for (let i = 1; i < data.length; i++) {
		const high = data[i].high;
		const low = data[i].low;
		const prevHigh = data[i - 1].high;
		const prevLow = data[i - 1].low;
		const prevClose = data[i - 1].close;

		const upMove = high - prevHigh;
		const downMove = prevLow - low;

		plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
		minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);

		const trValue = Math.max(
			high - low,
			Math.abs(high - prevClose),
			Math.abs(low - prevClose),
		);
		tr.push(trValue);
	}

	for (let i = 0; i < data.length; i++) {
		if (i < period) {
			adx.push(0);
			continue;
		}

		const avgTR = tr.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
		const avgPlusDM =
			plusDM.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
		const avgMinusDM =
			minusDM.slice(i - period, i).reduce((a, b) => a + b, 0) / period;

		if (avgTR === 0) {
			adx.push(0);
			continue;
		}

		const plusDI = (avgPlusDM / avgTR) * 100;
		const minusDI = (avgMinusDM / avgTR) * 100;

		const diSum = plusDI + minusDI;
		if (diSum === 0) {
			adx.push(0);
			continue;
		}

		const dx = (Math.abs(plusDI - minusDI) / diSum) * 100;
		adx.push(dx);
	}

	return adx;
}

function getBullScore(
	data: BTCData[],
	vwap: number[],
	rsi: number[],
	macd: number[],
	macdSignal: number[],
	ema9: number[],
	ema21: number[],
	volAvg: number[],
	adx: number[],
	idx: number,
): number {
	let score = 0;
	if (data[idx].close > vwap[idx]) score++;
	if (rsi[idx] > 50) score++;
	if (macd[idx] > macdSignal[idx]) score++;
	if (ema9[idx] > ema21[idx]) score++;
	if (adx[idx] > 25 && data[idx].close > ema9[idx]) score++;
	if ((data[idx].volume || 0) > volAvg[idx] && data[idx].close > data[idx].open)
		score++;
	return score;
}

function getBearScore(
	data: BTCData[],
	vwap: number[],
	rsi: number[],
	macd: number[],
	macdSignal: number[],
	ema9: number[],
	ema21: number[],
	volAvg: number[],
	adx: number[],
	idx: number,
): number {
	let score = 0;
	if (data[idx].close < vwap[idx]) score++;
	if (rsi[idx] < 50) score++;
	if (macd[idx] < macdSignal[idx]) score++;
	if (ema9[idx] < ema21[idx]) score++;
	if (adx[idx] > 25 && data[idx].close < ema9[idx]) score++;
	if ((data[idx].volume || 0) > volAvg[idx] && data[idx].close < data[idx].open)
		score++;
	return score;
}

async function fetchHistory(
	symbol: string = "BTC",
	interval: string = "1h",
	currency: string = "USDC",
): Promise<BTCData[]> {
	try {
		const res = await fetch(
			`/api/history?interval=${interval}&currency=${currency}&symbol=${symbol}`,
		);
		if (!res.ok) throw new Error(`Failed to fetch history: ${res.status}`);
		const json = await res.json();
		return json.map(
			(d: {
				time: number;
				o: number;
				h: number;
				l: number;
				c: number;
				v?: number;
			}) => ({
				time: d.time,
				open: d.o,
				high: d.h,
				low: d.l,
				close: d.c,
				volume: d.v,
			}),
		);
	} catch (error) {
		console.error("❌ 获取历史数据失败:", error);
		return [];
	}
}

let lastSignalState = 0;
let lastAlertTime = 0;

async function checkVIPSniper(): Promise<void> {
	const now = Date.now();
	if (now - lastAlertTime < 300000) return;

	const settings = await db
		.select()
		.from(userSettings)
		.where(eq(userSettings.id, "default"));
	if (settings.length > 0 && settings[0].vipSniper1hAlertEnabled === "false") {
		return;
	}

	const data = await fetchHistory("BTC", "1h", "USDC");
	if (data.length < 30) {
		console.log("数据不足，跳过");
		return;
	}

	const closes = data.map((d) => d.close);
	const ema9 = calculateEMA(closes, 9);
	const ema21 = calculateEMA(closes, 21);
	const rsi = calculateRSI(closes);
	const { macd, signal: macdSignal } = calculateMACD(closes);
	const vwap = calculateVWAP(data);
	const volAvg = calculateVolumeAvg(data);
	const adx = calculateADX(data);

	const lastIdx = data.length - 1;
	const prevIdx = lastIdx - 1;

	const buyCond =
		ema9[lastIdx] > ema21[lastIdx] && ema9[prevIdx] <= ema21[prevIdx];
	const sellCond =
		ema9[lastIdx] < ema21[lastIdx] && ema9[prevIdx] >= ema21[prevIdx];

	const triggerBuy = buyCond && lastSignalState <= 0;
	const triggerSell = sellCond && lastSignalState >= 0;

	const bullPct =
		(getBullScore(
			data,
			vwap,
			rsi,
			macd,
			macdSignal,
			ema9,
			ema21,
			volAvg,
			adx,
			lastIdx,
		) /
			6) *
		100;
	const bearPct =
		(getBearScore(
			data,
			vwap,
			rsi,
			macd,
			macdSignal,
			ema9,
			ema21,
			volAvg,
			adx,
			lastIdx,
		) /
			6) *
		100;

	const price = data[lastIdx].close;
	const timeStr = new Date(data[lastIdx].time * 1000).toLocaleString("zh-CN", {
		timeZone: "Asia/Shanghai",
	});

	if (triggerBuy && bullPct > 60) {
		lastSignalState = 1;
		lastAlertTime = now;
		const message = `🟢 <b>VIP Sniper 买入信号</b>
⏰ 时间: ${timeStr}
💰 价格: $${price.toFixed(2)}
📊 周期: 1h
📈 Bull Score: ${bullPct.toFixed(1)}%
🎯 信号: EMA 9/21 金叉`;
		console.log(message);
		await sendTelegramMessage(message);
	}

	if (triggerSell && bearPct > 60) {
		lastSignalState = -1;
		lastAlertTime = now;
		const message = `🔴 <b>VIP Sniper 卖出信号</b>
⏰ 时间: ${timeStr}
💰 价格: $${price.toFixed(2)}
📊 周期: 1h
📉 Bear Score: ${bearPct.toFixed(1)}%
🎯 信号: EMA 9/21 死叉`;
		console.log(message);
		await sendTelegramMessage(message);
	}

	if (!triggerBuy && !triggerSell) {
		console.log(
			`[VIP Sniper 1h] ${timeStr} | 价格: $${price.toFixed(2)} | Bull: ${bullPct.toFixed(1)}% | Bear: ${bearPct.toFixed(1)}% | 状态: ${lastSignalState === 1 ? "多头" : lastSignalState === -1 ? "空头" : "观望"}`,
		);
	}
}

export async function startVIPSniper1hMonitor() {
	if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
		console.log(
			"⚠️ VIP Sniper 1h Monitoring NOT started: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing.",
		);
		return;
	}

	console.log("=".repeat(60));
	console.log("🎯 VIP Sniper 1h 监控后台服务启动");
	console.log(`  检查间隔: 30秒`);
	console.log("=".repeat(60));

	await checkVIPSniper();
	setInterval(checkVIPSniper, 30000);
}
