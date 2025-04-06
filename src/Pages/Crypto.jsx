import { CryptoTreding } from "./CryptoTreding";

export default function Crypto() {
    return (
        <div>
            <CryptoTreding symbols={["BTC/USD", "ETH/USD", "BNB/USD", "SOL/USD", "XRP/USD"]} />
        </div>
    )
}