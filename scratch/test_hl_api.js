
async function test() {
  const symbol = 'BTC';
  const hlInterval = '1w';
  const now = Date.now();
  const intervalMs = 604800000;
  const startTimeMs = Math.max(0, now - intervalMs * 3000);
  
  console.log(`Testing HL API for ${symbol} ${hlInterval}`);
  console.log(`Range: ${new Date(startTimeMs).toISOString()} to ${new Date(now).toISOString()}`);
  
  const response = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "candleSnapshot",
      req: {
        coin: symbol,
        interval: hlInterval,
        startTime: startTimeMs,
        endTime: now,
      },
    }),
  });

  console.log(`Status: ${response.status}`);
  const data = await response.json();
  if (Array.isArray(data)) {
    console.log(`Received ${data.length} candles`);
    if (data.length > 0) {
      console.log(`First candle raw t: ${data[0].t}`);
      console.log(`First candle: ${new Date(data[0].t).toISOString()}`);
      console.log(`Last candle: ${new Date(data[data.length-1].t).toISOString()}`);
    }
  } else {
    console.log('Error or non-array response:', data);
  }
}

test();
