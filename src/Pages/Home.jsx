import { TradingSignals } from "./FxTreding";

export default function Home() {
    return (
        <div>
            <TradingSignals symbols={["EUR/:FX", "GBP/JPY:FX",]} />
        </div>
    )
}