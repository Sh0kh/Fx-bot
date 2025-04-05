import { TradingSignals } from "./BinanceTred";

export default function Home() {
    return (
        <div>
            <TradingSignals symbols={["BTC/USD", "ETH/USD", "BNB/USD", "SOL/USD", "XRP/USD"]} />
        </div>
    )
}