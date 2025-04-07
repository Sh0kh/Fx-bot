import { TradingSignals } from "./FxTreding";

export default function Home() {
    return (
        <div>
            <TradingSignals symbols={["EUR/USD:FX", "GBP/JPY:FX",]} />
        </div>
    )
}