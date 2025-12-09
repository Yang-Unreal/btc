import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
export async function GET({ request }: APIEvent) {
const url = new URL(request.url);
// Default to 1 day if not specified
const interval = url.searchParams.get("interval") || "1d";
// Binance.US (Required for US IP)
const usUrl = `https://api.binance.us/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=500`;
// International Fallback
const intlUrl = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=500`;
try {
// 1. Try Binance US first
const response = await fetch(usUrl);
if (response.ok) {
  const data = await response.json();
  return json(data);
}

// 2. Fallback to International
console.log(`Binance US fetch failed (${response.status}), trying International...`);
const backupResponse = await fetch(intlUrl);

if (!backupResponse.ok) {
  throw new Error(`Upstream error: ${backupResponse.status}`);
}

const data = await backupResponse.json();
return json(data);
} catch (error) {
console.error("Data Proxy Error:", error);
return json({ error: "Failed to fetch historical data" }, { status: 500 });
}
}