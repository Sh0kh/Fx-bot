import React, { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";

// Конфигурация API
const API_KEY = "a9db6b712c1a40299e39d7266af5b2b3";
const BASE_URL = "https://api.twelvedata.com/time_series";
const INTERVAL = "5min";
const OUTPUT_SIZE = 500;

// Вспомогательные функции для индикаторов
const calculateEMA = (prices, period) => {
    const k = 2 / (period + 1);
    let ema = [prices[0]];
    for (let i = 1; i < prices.length; i++) {
        ema.push(prices[i] * k + ema[i - 1] * (1 - k));
    }
    return ema;
};

const calculateRSI = (prices, period = 14) => {
    let gains = [];
    let losses = [];
    for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
    }

    const rsi = [];
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < prices.length; i++) {
        if (i > period) {
            avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
            avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
        }
        const rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss);
        rsi.push(100 - (100 / (1 + rs)));
    }
    return Array(period).fill(null).concat(rsi);
};

const calculateBollingerBands = (prices, period = 20, multiplier = 2) => {
    const bands = [];
    for (let i = period - 1; i < prices.length; i++) {
        const slice = prices.slice(i - period + 1, i + 1);
        const sma = slice.reduce((a, b) => a + b, 0) / period;
        const squaredDiffs = slice.map(price => Math.pow(price - sma, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
        const stdDev = Math.sqrt(variance);
        bands.push({
            middle: sma,
            upper: sma + (multiplier * stdDev),
            lower: sma - (multiplier * stdDev)
        });
    }
    return Array(period - 1).fill(null).concat(bands);
};

const calculateMACD = (prices, fast = 12, slow = 26, signal = 9) => {
    const fastEMA = calculateEMA(prices, fast);
    const slowEMA = calculateEMA(prices, slow);
    const MACD = fastEMA.map((e, i) => e - slowEMA[i]);
    const signalLine = calculateEMA(MACD, signal);
    const histogram = MACD.map((m, i) => m - (signalLine[i] || 0));
    return { MACD, signalLine, histogram };
};

const calculateATR = (highs, lows, closes, period = 14) => {
    const tr = [];
    for (let i = 1; i < highs.length; i++) {
        tr.push(Math.max(
            highs[i] - lows[i],
            Math.abs(highs[i] - closes[i - 1]),
            Math.abs(lows[i] - closes[i - 1])
        ));
    }
    const atr = [];
    let sum = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
    atr.push(sum);
    for (let i = period; i < tr.length; i++) {
        sum = (sum * (period - 1) + tr[i]) / period;
        atr.push(sum);
    }
    return Array(closes.length - atr.length).fill(null).concat(atr);
};

const calculateADX = (highs, lows, closes, period = 14) => {
    const tr = [];
    const plusDM = [];
    const minusDM = [];

    for (let i = 1; i < highs.length; i++) {
        const upMove = highs[i] - highs[i - 1];
        const downMove = lows[i - 1] - lows[i];

        tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));

        if (upMove > downMove && upMove > 0) {
            plusDM.push(upMove);
            minusDM.push(0);
        } else if (downMove > upMove && downMove > 0) {
            plusDM.push(0);
            minusDM.push(downMove);
        } else {
            plusDM.push(0);
            minusDM.push(0);
        }
    }

    const atr = calculateATR(highs, lows, closes, period);
    const smoothedPlusDM = [];
    const smoothedMinusDM = [];

    let sumPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
    let sumMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);

    smoothedPlusDM.push(sumPlusDM);
    smoothedMinusDM.push(sumMinusDM);

    for (let i = period; i < plusDM.length; i++) {
        sumPlusDM = (sumPlusDM * (period - 1) + plusDM[i]) / period;
        sumMinusDM = (sumMinusDM * (period - 1) + minusDM[i]) / period;
        smoothedPlusDM.push(sumPlusDM);
        smoothedMinusDM.push(sumMinusDM);
    }

    const plusDI = smoothedPlusDM.map((dm, i) => 100 * dm / atr[i + period - 1]);
    const minusDI = smoothedMinusDM.map((dm, i) => 100 * dm / atr[i + period - 1]);
    const dx = plusDI.map((pdi, i) => 100 * Math.abs(pdi - minusDI[i]) / (pdi + minusDI[i]));

    const adx = [];
    let sumDX = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
    adx.push(sumDX);

    for (let i = period; i < dx.length; i++) {
        sumDX = (sumDX * (period - 1) + dx[i]) / period;
        adx.push(sumDX);
    }

    return Array(closes.length - adx.length).fill(null).concat(adx);
};

const findSupportResistance = (highs, lows, closes, window = 50) => {
    const swingPoints = [];

    for (let i = window; i < closes.length - window; i++) {
        const left = closes.slice(i - window, i);
        const right = closes.slice(i + 1, i + window + 1);

        if (Math.max(...left, ...right) < closes[i]) {
            swingPoints.push({ type: 'resistance', value: closes[i] });
        }
        if (Math.min(...left, ...right) > closes[i]) {
            swingPoints.push({ type: 'support', value: closes[i] });
        }
    }

    const clusterThreshold = 0.002;
    const clusters = swingPoints.reduce((acc, point) => {
        const cluster = acc.find(c =>
            Math.abs(c.value - point.value) < clusterThreshold * c.value
        );
        if (cluster) {
            cluster.points.push(point);
            cluster.value = (cluster.value * cluster.points.length + point.value) / (cluster.points.length + 1);
            cluster.strength += 1;
        } else {
            acc.push({
                type: point.type,
                value: point.value,
                points: [point],
                strength: 1
            });
        }
        return acc;
    }, []);

    return clusters
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 5); // Возвращаем топ-5 самых сильных уровней
};

export const fetchHistoricalData = async (symbol, setCurrentPrices) => {
    try {
        const url = `${BASE_URL}?symbol=${symbol}&interval=${INTERVAL}&outputsize=${OUTPUT_SIZE}&apikey=${API_KEY}`;
        const response = await axios.get(url);

        if (response.data.status === "error") {
            throw new Error(response.data.message);
        }

        const data = response.data.values;
        setCurrentPrices(prev => ({
            ...prev,
            [symbol]: parseFloat(data[0].close)
        }));

        return {
            symbol,
            closes: data.map(candle => parseFloat(candle.close)),
            highs: data.map(candle => parseFloat(candle.high)),
            lows: data.map(candle => parseFloat(candle.low)),
            volumes: data.map(candle => parseFloat(candle.volume || 0)),
            times: data.map(candle => candle.datetime)
        };
    } catch (error) {
        Swal.fire({
            icon: "error",
            title: "Ошибка получения данных",
            text: `Не удалось получить данные для ${symbol}: ${error.message}`,
            confirmButtonText: "OK"
        });
        return null;
    }
};

export const calculateIndicators = (data) => {
    if (!data) return null;
    const { closes, highs, lows, volumes } = data;

    try {
        const ema50 = calculateEMA(closes, 50);
        const ema200 = calculateEMA(closes, 200);
        const rsi = calculateRSI(closes);
        const bollingerBands = calculateBollingerBands(closes);
        const macd = calculateMACD(closes);
        const atr = calculateATR(highs, lows, closes);
        const adx = calculateADX(highs, lows, closes);
        const supportResistance = findSupportResistance(highs, lows, closes);

        // Анализ объема
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const currentVolume = volumes[0];
        const volumeRatio = currentVolume / avgVolume;

        return {
            ema50,
            ema200,
            rsi,
            bollingerBands,
            macd,
            atr,
            adx,
            supportResistance,
            volumeRatio
        };
    } catch (error) {
        Swal.fire({
            icon: "error",
            title: "Ошибка расчета индикаторов",
            text: `Произошла ошибка при расчете технических индикаторов: ${error.message}`,
            confirmButtonText: "OK"
        });
        return null;
    }
};

export const generateSignals = (data, indicators) => {
    if (!data || !indicators) return null;
    const { closes, highs, lows, symbol } = data;
    const {
        ema50, ema200, rsi, bollingerBands,
        macd, atr, adx, supportResistance,
        volumeRatio
    } = indicators;

    try {
        const currentClose = closes[0];
        const currentHigh = highs[0];
        const currentLow = lows[0];
        const currentEMA50 = ema50[0];
        const currentEMA200 = ema200[0];
        const currentRSI = rsi[0] || 50;
        const currentBB = bollingerBands[bollingerBands.length - 1] || {
            upper: currentClose * 1.01,
            middle: currentClose,
            lower: currentClose * 0.99
        };
        const currentATR = atr[atr.length - 1] || 0;
        const currentADX = adx[adx.length - 1] || 0;
        const macdHistogram = macd.histogram[0];
        const macdDirection = macdHistogram > 0 ? 'bullish' : 'bearish';
        const bbPercent = (currentClose - currentBB.lower) / (currentBB.upper - currentBB.lower);

        let signalType = "NEUTRAL";
        let entryPrice = 0;
        let stopLoss = 0;
        let takeProfit = 0;
        let confidenceLevel = 0;
        let confidenceText = "";
        let reasons = [];

        // Условия для сигналов
        const trendUp = currentEMA50 > currentEMA200;
        const trendDown = currentEMA50 < currentEMA200;
        const rsiOverbought = currentRSI > 65;
        const rsiOversold = currentRSI < 35;
        const strongTrend = currentADX > 25;
        const highVolume = volumeRatio > 1.5;

        // Находим ближайшие уровни S/R
        const nearestSupport = supportResistance
            .filter(s => s.type === 'support')
            .sort((a, b) => currentClose - a.value)[0]?.value || currentLow * 0.99;

        const nearestResistance = supportResistance
            .filter(s => s.type === 'resistance')
            .sort((a, b) => a.value - currentClose)[0]?.value || currentHigh * 1.01;

        // BUY Сигнал (многофакторный)
        if (
            (trendUp || strongTrend) &&
            (rsiOversold || bbPercent < 0.2) &&
            macdDirection === 'bullish' &&
            currentClose <= nearestSupport * 1.005
        ) {
            signalType = "BUY";
            entryPrice = currentClose;

            // Расчет стоп-лосса с учетом ATR и поддержки
            const supportStop = nearestSupport * 0.995;
            const atrStop = currentClose - currentATR * 1.5;
            stopLoss = Math.min(supportStop, atrStop, currentLow * 0.998);

            // Расчет тейк-профита с учетом ATR и сопротивления
            const resistanceTarget = nearestResistance * 0.995;
            const atrTarget = currentClose + currentATR * 3;
            takeProfit = Math.min(resistanceTarget, atrTarget);

            // Расчет уровня доверия
            const confidenceFactors = [
                ['Восходящий тренд', trendUp ? 20 : 0],
                ['Сильный тренд (ADX > 25)', strongTrend ? 15 : 0],
                ['RSI перепродан', rsiOversold ? 15 : 0],
                ['Цена у нижней BB', bbPercent < 0.2 ? 10 : 0],
                ['MACD бычий', macdDirection === 'bullish' ? 10 : 0],
                ['Близко к поддержке', currentClose <= nearestSupport * 1.005 ? 15 : 0],
                ['Высокий объем', highVolume ? 15 : 0]
            ];

            confidenceLevel = confidenceFactors.reduce((sum, factor) => sum + factor[1], 0);
            reasons = confidenceFactors.filter(f => f[1] > 0).map(f => f[0]);
        }

        // SELL Сигнал (многофакторный)
        else if (
            (trendDown || strongTrend) &&
            (rsiOverbought || bbPercent > 0.8) &&
            macdDirection === 'bearish' &&
            currentClose >= nearestResistance * 0.995
        ) {
            signalType = "SELL";
            entryPrice = currentClose;

            // Расчет стоп-лосса с учетом ATR и сопротивления
            const resistanceStop = nearestResistance * 1.005;
            const atrStop = currentClose + currentATR * 1.5;
            stopLoss = Math.max(resistanceStop, atrStop, currentHigh * 1.002);

            // Расчет тейк-профита с учетом ATR и поддержки
            const supportTarget = nearestSupport * 1.005;
            const atrTarget = currentClose - currentATR * 3;
            takeProfit = Math.max(supportTarget, atrTarget);

            // Расчет уровня доверия
            const confidenceFactors = [
                ['Нисходящий тренд', trendDown ? 20 : 0],
                ['Сильный тренд (ADX > 25)', strongTrend ? 15 : 0],
                ['RSI перекуплен', rsiOverbought ? 15 : 0],
                ['Цена у верхней BB', bbPercent > 0.8 ? 10 : 0],
                ['MACD медвежий', macdDirection === 'bearish' ? 10 : 0],
                ['Близко к сопротивлению', currentClose >= nearestResistance * 0.995 ? 15 : 0],
                ['Высокий объем', highVolume ? 15 : 0]
            ];

            confidenceLevel = confidenceFactors.reduce((sum, factor) => sum + factor[1], 0);
            reasons = confidenceFactors.filter(f => f[1] > 0).map(f => f[0]);
        }

        // Классификация уровня доверия
        confidenceText = confidenceLevel >= 80 ? 'Very High' :
            confidenceLevel >= 65 ? 'High' :
                confidenceLevel >= 50 ? 'Medium' : 'Low';

        // Расчет целевых пунктов
        let pipsTarget = 0;
        if (signalType !== "NEUTRAL") {
            const isFourDecimal = !symbol.includes("JPY");
            const pipMultiplier = isFourDecimal ? 10000 : 100;
            pipsTarget = Math.abs(takeProfit - entryPrice) * pipMultiplier;
        }

        return {
            symbol,
            signalType,
            timestamp: new Date().toISOString(),
            currentPrice: currentClose,
            entryPrice,
            stopLoss,
            takeProfit,
            pipsTarget: Math.round(pipsTarget),
            confidenceLevel,
            confidenceText,
            reasons
        };
    } catch (error) {
        Swal.fire({
            icon: "error",
            title: "Ошибка генерации сигналов",
            text: `Произошла ошибка при генерации торговых сигналов: ${error.message}`,
            confirmButtonText: "OK"
        });
        return null;
    }
};

export const analyzeAndGenerateSignals = async (symbol, setCurrentPrices, setSignals) => {
    try {
        const historicalData = await fetchHistoricalData(symbol, setCurrentPrices);
        if (!historicalData) return;

        const indicators = calculateIndicators(historicalData);
        if (!indicators) return;

        const signal = generateSignals(historicalData, indicators);
        if (!signal) return;

        if (signal.signalType !== "NEUTRAL") {
            setSignals(prev => ({ ...prev, [symbol]: signal }));

            Swal.fire({
                icon: "info",
                title: `Новый ${signal.signalType} сигнал для ${symbol}`,
                html: `
          <div>
            <p><strong>Точка входа:</strong> ${signal.entryPrice.toFixed(5)}</p>
            <p><strong>Стоп-лосс:</strong> ${signal.stopLoss.toFixed(5)}</p>
            <p><strong>Тейк-профит:</strong> ${signal.takeProfit.toFixed(5)}</p>
            <p><strong>Целевое движение:</strong> ${signal.pipsTarget} пунктов</p>
            <p><strong>Уровень доверия:</strong> ${signal.confidenceText} (${signal.confidenceLevel}%)</p>
            <p><strong>Основания:</strong> ${signal.reasons.join(', ')}</p>
          </div>
        `,
                confirmButtonText: "OK"
            });
        }
        return signal;
    } catch (error) {
        Swal.fire({
            icon: "error",
            title: "Ошибка анализа",
            text: `Не удалось проанализировать данные для ${symbol}: ${error.message}`,
            confirmButtonText: "OK"
        });
        return null;
    }
};

export const TradingSignals = ({ symbols = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD"] }) => {
    const [currentPrices, setCurrentPrices] = useState({});
    const [signals, setSignals] = useState({});
    const [loading, setLoading] = useState({});

    const analyzeSymbol = async (symbol) => {
        setLoading(prev => ({ ...prev, [symbol]: true }));
        try {
            await analyzeAndGenerateSignals(symbol, setCurrentPrices, setSignals);
        } catch (error) {
            Swal.fire({
                icon: "error",
                title: "Непредвиденная ошибка",
                text: `Произошла непредвиденная ошибка при анализе ${symbol}: ${error.message}`,
                confirmButtonText: "OK"
            });
        } finally {
            setLoading(prev => ({ ...prev, [symbol]: false }));
        }
    };

    const analyzeAllSymbols = async () => {
        try {
            for (const symbol of symbols) {
                setLoading(prev => ({ ...prev, [symbol]: true }));
                await analyzeAndGenerateSignals(symbol, setCurrentPrices, setSignals);
                setLoading(prev => ({ ...prev, [symbol]: false }));
            }
        } catch (error) {
            Swal.fire({
                icon: "error",
                title: "Ошибка анализа всех символов",
                text: `Произошла ошибка при выполнении анализа: ${error.message}`,
                confirmButtonText: "OK"
            });
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Улучшенная система торговых сигналов</h2>

            <div className="mb-6 flex justify-between items-center flex-wrap gap-[20px]">
                <button
                    onClick={analyzeAllSymbols}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out"
                >
                    Проанализировать все символы
                </button>
                <div className="text-sm text-gray-600">
                    <p>Система использует: EMA50/200, RSI, Bollinger Bands, MACD, ATR, ADX</p>
                    <p>Многофакторный анализ с оценкой доверия</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {symbols.map(symbol => (
                    <div key={symbol} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
                        <div className="flex justify-between items-center p-4 bg-gray-50 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-700">{symbol}</h3>
                            <span className="text-xl font-bold text-gray-800">
                                {currentPrices[symbol] ? currentPrices[symbol].toFixed(5) : '—'}
                            </span>
                        </div>

                        <div className="p-4">
                            {signals[symbol] ? (
                                <div className={`rounded-md p-3 ${signals[symbol].signalType === "BUY"
                                    ? "bg-green-50 border-l-4 border-green-500"
                                    : "bg-red-50 border-l-4 border-red-500"
                                    }`}>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className={`font-semibold ${signals[symbol].signalType === "BUY"
                                            ? "text-green-600"
                                            : "text-red-600"
                                            }`}>
                                            {signals[symbol].signalType} Signal
                                        </span>
                                        <span className={`text-xs px-2 py-1 rounded-full ${signals[symbol].confidenceText === 'Very High' ? "bg-green-100 text-green-800" :
                                                signals[symbol].confidenceText === 'High' ? "bg-blue-100 text-blue-800" :
                                                    signals[symbol].confidenceText === 'Medium' ? "bg-yellow-100 text-yellow-800" :
                                                        "bg-gray-100 text-gray-800"
                                            }`}>
                                            {signals[symbol].confidenceText} ({signals[symbol].confidenceLevel}%)
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div className="text-sm">
                                            <span className="font-medium text-gray-600">Entry:</span> {signals[symbol].entryPrice.toFixed(5)}
                                        </div>
                                        <div className="text-sm">
                                            <span className="font-medium text-gray-600">SL:</span> {signals[symbol].stopLoss.toFixed(5)}
                                        </div>
                                        <div className="text-sm">
                                            <span className="font-medium text-gray-600">TP:</span> {signals[symbol].takeProfit.toFixed(5)}
                                        </div>
                                        <div className="text-sm">
                                            <span className="font-medium text-gray-600">Target:</span> {signals[symbol].pipsTarget} pips
                                        </div>
                                    </div>

                                    <div className="mt-2">
                                        <p className="text-sm font-medium text-gray-700">Основания:</p>
                                        <ul className="text-sm text-gray-600 pl-4 mt-1 list-disc">
                                            {signals[symbol].reasons.map((reason, idx) => (
                                                <li key={idx} className="mt-1">{reason}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    {loading[symbol] ? 'Анализ...' : 'Нет активных сигналов'}
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-200">
                            <button
                                onClick={() => analyzeSymbol(symbol)}
                                disabled={loading[symbol]}
                                className={`w-full py-2 px-4 rounded-md transition duration-200 ease-in-out ${loading[symbol]
                                    ? "bg-gray-300 cursor-not-allowed text-gray-500"
                                    : "bg-blue-500 hover:bg-blue-600 text-white shadow-sm"
                                    }`}
                            >
                                {loading[symbol] ? 'Анализ...' : 'Проанализировать'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};