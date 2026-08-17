import { and, eq } from "drizzle-orm";
import { ASSET_MAP } from "../lib/constants";
import { assertDb, db } from "../lib/db";
import { priceAlerts } from "../lib/db/schema";

assertDb();

const HL_WS = "wss://api.hyperliquid.xyz/ws";
const CHECK_INTERVAL_MS = 30_000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

type Subscription = { coin: string; hlKey: string };

const state = {
	ws: null as WebSocket | null,
	pingTimer: null as number | null,
	reconnectTimer: null as number | null,
	subscriptions: new Map<string, Subscription>(),
	previousPrices: {} as Record<string, number>,
	connecting: false,
	recentlyTriggered: new Set<string>(),
};

const HL_COIN_TO_SYMBOL: Record<string, string> = {};
for (const [sym, cfg] of Object.entries(ASSET_MAP)) {
	if (cfg.hlSymbol) HL_COIN_TO_SYMBOL[cfg.hlSymbol] = sym;
}

async function fetchActiveAlerts() {
	return db
		.select()
		.from(priceAlerts)
		.where(
			and(eq(priceAlerts.enabled, "true"), eq(priceAlerts.triggered, "false")),
		);
}

async function sendTelegramMessage(message: string): Promise<void> {
	if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
		console.log("[price-alerts-ws] Telegram not configured, skipping");
		return;
	}

	const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
	try {
		console.log("[price-alerts-ws] Sending Telegram message...");
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
		console.log("[price-alerts-ws] Telegram response:", res.status, text.slice(0, 200));
	} catch (e) {
		console.error("[price-alerts-ws] Telegram error:", e);
	}
}

function subscribe(ws: WebSocket, coin: string) {
	if (state.subscriptions.has(coin)) return;
	const hlKey = ASSET_MAP[coin]?.hlSymbol || coin;
	state.subscriptions.set(coin, { coin, hlKey });
	console.log("[price-alerts-ws] subscribing to trades for", coin, "-> hlKey:", hlKey);
	ws.send(
		JSON.stringify({
			method: "subscribe",
			subscription: { type: "trades", coin: hlKey },
		}),
	);
}

function unsubscribe(ws: WebSocket, coin: string) {
	const sub = state.subscriptions.get(coin);
	if (!sub) return;
	state.subscriptions.delete(coin);
	console.log("[price-alerts-ws] unsubscribing trades for", coin, "-> hlKey:", sub.hlKey);
	ws.send(
		JSON.stringify({
			method: "unsubscribe",
			subscription: { type: "trades", coin: sub.hlKey },
		}),
	);
}

async function syncSubscriptions(ws: WebSocket) {
	const alerts = await fetchActiveAlerts();
	const needed = new Set(alerts.map((a) => a.symbol || "BTC"));
	console.log("[price-alerts-ws] syncSubscriptions, active alerts:", alerts.length, "symbols:", [...needed]);

	for (const [coin] of state.subscriptions) {
		if (!needed.has(coin)) unsubscribe(ws, coin);
	}
	for (const coin of needed) {
		if (!state.subscriptions.has(coin)) subscribe(ws, coin);
	}
}

async function handleTrade(data: any[]) {
	const alerts = await fetchActiveAlerts();
	if (alerts.length === 0) return;

	const bySymbol = new Map<string, typeof alerts>();
	for (const alert of alerts) {
		if (state.recentlyTriggered.has(alert.id)) continue;
		const sym = alert.symbol || "BTC";
		const arr = bySymbol.get(sym);
		if (arr) arr.push(alert);
		else bySymbol.set(sym, [alert]);
	}

	for (const trade of data) {
		const coin = trade.coin;
		const px = parseFloat(trade.px);
		if (!coin || Number.isNaN(px)) continue;

		const sym = HL_COIN_TO_SYMBOL[coin] || coin;
		const list = bySymbol.get(sym);
		if (!list) {
			console.log("[price-alerts-ws] no alert for coin:", coin, "-> sym:", sym, "available:", [...bySymbol.keys()]);
			continue;
		}

		const prev = state.previousPrices[sym] || 0;
		state.previousPrices[sym] = px;

		for (const alert of list) {
			const target = Number(alert.targetPrice);
			const crossedUp = prev > 0 && prev < target && px >= target;
			const crossedDown = prev > 0 && prev > target && px <= target;

			console.log("[price-alerts-ws]", sym, "px=", px, "target=", target, "prev=", prev, "match=", crossedUp || crossedDown, "triggered=", alert.triggered);

			if (crossedUp || crossedDown) {
				state.recentlyTriggered.add(alert.id);

				await db
					.update(priceAlerts)
					.set({ triggered: "true", enabled: "false", updatedAt: new Date() })
					.where(eq(priceAlerts.id, alert.id));

				const timeStr = new Date().toLocaleString("zh-CN", {
					timeZone: "Asia/Shanghai",
				});
				await sendTelegramMessage(
					[
						`🔔 <b>${sym} 价格提醒触发!</b>`,
						"",
						`⏰ 时间: ${timeStr}`,
						`💰 当前价格: <b>$${px.toFixed(2)}</b>`,
						`🎯 目标价格: <b>$${target.toFixed(2)}</b>`,
						"",
						"🚀 价格已达到您的预设目标！",
					].join("\n"),
				);
			}
		}
	}
}

function connect() {
	if (typeof WebSocket === "undefined") return;
	if (state.connecting) return;
	if (state.ws && state.ws.readyState === WebSocket.OPEN) return;

	state.connecting = true;

	const ws = new WebSocket(HL_WS);
	state.ws = ws;

	ws.onopen = async () => {
		state.connecting = false;
		console.log("[price-alerts-ws] WS connected, syncing subscriptions...");
		await syncSubscriptions(ws);

		state.pingTimer = setInterval(() => {
			if (ws.readyState === WebSocket.OPEN)
				ws.send(JSON.stringify({ method: "ping" }));
		}, 30_000);
	};

	ws.onmessage = async (event) => {
		try {
			const msg = JSON.parse(event.data);
			if (
				!msg ||
				msg.channel === "subscriptionResponse" ||
				msg.channel === "pong"
			)
				return;

			if (msg.channel === "trades" && Array.isArray(msg.data)) {
				console.log("[price-alerts-ws] trades received, count:", msg.data.length, "coins:", msg.data.map(t => t.coin));
				await handleTrade(msg.data);
			}
		} catch {
			// ignore parse errors
		}
	};

	ws.onclose = () => {
		if (state.pingTimer !== null) {
			clearInterval(state.pingTimer);
			state.pingTimer = null;
		}
		state.connecting = false;
		state.ws = null;
		state.subscriptions.clear();
		state.reconnectTimer = setTimeout(connect, 2000);
	};

	ws.onerror = () => {
		state.connecting = false;
		ws.close();
	};
}

export async function startPriceAlertMonitor() {
	if (typeof WebSocket === "undefined") {
		console.log("[price-alerts-ws] WebSocket not available, skipping monitor");
		return;
	}
	connect();
	setInterval(async () => {
		if (state.ws?.readyState === WebSocket.OPEN) {
			await syncSubscriptions(state.ws);
		}
	}, CHECK_INTERVAL_MS);
	setInterval(() => {
		state.recentlyTriggered.clear();
	}, 5 * 60 * 1000);
}
