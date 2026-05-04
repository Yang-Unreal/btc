
async function testWS() {
  const symbol = 'BTC';
  const hlInterval = '1w';
  
  console.log(`Testing HL WS for ${symbol} ${hlInterval}`);
  
  // Use global WebSocket in Node 22
  const ws = new WebSocket("wss://api.hyperliquid.xyz/ws");
  
  ws.onopen = () => {
    console.log('WS Connected');
    ws.send(JSON.stringify({
      method: "subscribe",
      subscription: { type: "candle", coin: symbol, interval: hlInterval },
    }));
    
    // Set a timeout to close if no message received
    setTimeout(() => {
      console.log('No message received after 10s, closing...');
      ws.close();
      process.exit(0);
    }, 10000);
  };
  
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    console.log('Received message:', JSON.stringify(msg).substring(0, 200));
    if (msg.channel === 'subscriptionResponse') {
      console.log('Subscription response received');
    } else if (msg.channel === 'candle') {
      console.log('CANDLE DATA RECEIVED!');
      ws.close();
      process.exit(0);
    }
  };
  
  ws.onerror = (err) => {
    console.error('WS Error:', err);
  };
  
  ws.onclose = () => {
    console.log('WS Closed');
  };
}

testWS();
