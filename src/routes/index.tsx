import { Title } from "@solidjs/meta";
import BTCChart from "~/components/BTCChart";

export default function Home() {
  return (
    <main>
      <Title>Bitcoin Investment Analysis</Title>
      <h1>Bitcoin Investment & Market Analysis</h1>
      <BTCChart />
      <p>
        Based on comprehensive market analysis including technical indicators, macroeconomic factors, and trading mechanisms.
      </p>
    </main>
  );
}
