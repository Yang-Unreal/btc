const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function test() {
	console.log("正在尝试发送测试消息...");
	console.log("Token:", TELEGRAM_BOT_TOKEN?.substring(0, 10) + "...");
	console.log("Chat ID:", TELEGRAM_CHAT_ID);

	const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				chat_id: TELEGRAM_CHAT_ID,
				text: "🚀 <b>Telegram 监控测试</b>\n\n均线密集提醒机器人已准备就绪！",
				parse_mode: "HTML",
			}),
		});

		const data = await response.json();
		if (data.ok) {
			console.log("✅ 测试消息发送成功！请检查你的 Telegram。");
		} else {
			console.error("❌ 发送失败:", data);
		}
	} catch (e) {
		console.error("❌ 发生异常:", e);
	}
}

test();
