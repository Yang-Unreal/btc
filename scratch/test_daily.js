
async function testDaily() {
  const symbol = 'BTC';
  const now = Date.now();
  const startTimeMs = now - 10 * 24 * 60 * 60 * 1000; // Last 10 days
  
  const response = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "candleSnapshot",
      req: {
        coin: symbol,
        interval: "1d",
        startTime: startTimeMs,
        endTime: now,
      },
    }),
  });

  const data = await response.json();
  if (Array.isArray(data)) {
    data.forEach(c => {
      console.log(`${new Date(c.t).toISOString()} | O: ${c.o} | C: ${c.c}`);
    });
  }
}

testDaily();
