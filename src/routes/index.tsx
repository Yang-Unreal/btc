import { Title } from "@solidjs/meta";
import BTCChart from "~/components/BTCChart";

export default function Home() {
  return (
    <main class="w-full min-h-screen bg-gray-50 text-gray-800 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Title>Bitcoin Investment Analysis</Title>
      
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16">
        {/* Hero Section */}
        <div class="text-center mb-10 md:mb-16">
          <h1 class="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-6">
            Bitcoin <span class="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-blue-500 block sm:inline">Insight</span>
          </h1>
          <p class="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto font-normal leading-relaxed px-4">
            Real-time institutional market analysis combining technical indicators, macroeconomic factors, and live trading data.
          </p>
        </div>

        {/* Main Chart Component */}
        <div class="w-full mb-12">
          <BTCChart />
        </div>

        {/* Info Grid - Responsive Columns */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
            <h3 class="font-bold text-gray-900 text-lg mb-3 flex items-center gap-2">
              <span class="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
              Technical Analysis
            </h3>
            <p class="text-sm text-gray-500 leading-relaxed">
              Advanced charting with configurable EMA indicators (20, 60, 120, 150, 200) designed for trend identification and dynamic support/resistance levels.
            </p>
          </div>
          
          <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
            <h3 class="font-bold text-gray-900 text-lg mb-3 flex items-center gap-2">
              <span class="w-2 h-2 bg-teal-500 rounded-full"></span>
              Live Data Feed
            </h3>
            <p class="text-sm text-gray-500 leading-relaxed">
              Direct WebSocket integration providing sub-second price updates and seamless historical OHLC data synchronization across multiple timeframes.
            </p>
          </div>
          
          <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
             <h3 class="font-bold text-gray-900 text-lg mb-3 flex items-center gap-2">
              <span class="w-2 h-2 bg-rose-500 rounded-full"></span>
              Strategic Overview
            </h3>
            <p class="text-sm text-gray-500 leading-relaxed">
              Comprehensive tools designed to assist in evaluating market sentiment, identifying entry/exit points, and monitoring volatility in real-time.
            </p>
          </div>
        </div>
        
        <footer class="mt-16 text-center text-xs text-gray-400 border-t border-gray-200 pt-8">
          <p>© {new Date().getFullYear()} Bitcoin Analytics Dashboard. Data provided by Kraken API.</p>
        </footer>
      </div>
    </main>
  );
}
