import { TradingSignals } from "./Tred";

export default function Home() {
    return (
        <div>
            <TradingSignals symbols={["EUR/USD:FX", "GBP/USD:FX",]} />
        </div>
    )
}