import React, { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { SMA, RSI, MACD, EMA, BollingerBands } from "technicalindicators";

// Настройки API Binance
const BINANCE_BASE_URL = "https://api.binance.com/api/v3";
const INTERVAL = "15m"; // В Binance используется 'm' вместо 'min'
const LIMIT = 500;

// Важные новостные события (время UTC)
const HIGH_IMPACT_NEWS = [
    { time: "12:30", title: "Изменение занятости в США (NonFarm Payrolls)" },
    { time: "14:00", title: "Решение FOMC по ставкам" },
    { time: "12:15", title: "Выступление главы ФРС Пауэлла" }
];

// Проверка новостного периода
const isHighImpactNewsTime = () => {
    const now = new Date();
    const hours = now.getUTCHours();
    const minutes = now.getUTCMinutes();
    const currentTime = `${hours}:${minutes < 10 ? '0' + minutes : minutes}`;

    return HIGH_IMPACT_NEWS.some(news => {
        const [newsHour, newsMinute] = news.time.split(':').map(Number);
        const diffMinutes = Math.abs((hours * 60 + minutes) - (newsHour * 60 + newsMinute));
        return diffMinutes < 90; // 1.5 часа до и после новости
    });
};

// Конвертация формата символа из "BTC/USD" в формат Binance "BTCUSDT"
const formatSymbolForBinance = (symbol) => {
    return symbol.replace("/", "").concat("T");
};

export const fetchHistoricalData = async (symbol, setCurrentPrices) => {
    try {
        const binanceSymbol = formatSymbolForBinance(symbol);
        const url = `${BINANCE_BASE_URL}/klines?symbol=${binanceSymbol}&interval=${INTERVAL}&limit=${LIMIT}`;
        const response = await axios.get(url);

        if (!response.data || response.data.length < LIMIT * 0.8) {
            throw new Error("Недостаточно данных от API Binance");
        }

        const data = response.data;

        const closes = data.map(candle => parseFloat(candle[4]));
        const highs = data.map(candle => parseFloat(candle[2]));
        const lows = data.map(candle => parseFloat(candle[3]));
        const volumes = data.map(candle => parseFloat(candle[5]));
        const times = data.map(candle => new Date(candle[0]).toISOString());

        // Обновление текущей цены
        setCurrentPrices(prev => ({
            ...prev,
            [symbol]: closes[closes.length - 1]
        }));

        return {
            symbol,
            closes,
            highs,
            lows,
            volumes,
            times
        };
    } catch (error) {
        console.error(`Ошибка получения данных для ${symbol}:`, error);
        return null;
    }
};

// Получение текущей цены для одного символа
export const fetchCurrentPrice = async (symbol) => {
    try {
        const binanceSymbol = formatSymbolForBinance(symbol);
        const url = `${BINANCE_BASE_URL}/ticker/price?symbol=${binanceSymbol}`;
        const response = await axios.get(url);

        if (response.data && response.data.price) {
            return parseFloat(response.data.price);
        }
        return null;
    } catch (error) {
        console.error(`Ошибка получения текущей цены для ${symbol}:`, error);
        return null;
    }
};

const calculateIndicators = (data) => {
    if (!data) return null;
    const { closes, highs, lows, volumes } = data;

    try {
        // Скользящие средние
        const sma50 = SMA.calculate({ period: 50, values: closes });
        const sma200 = SMA.calculate({ period: 200, values: closes });
        const ema20 = EMA.calculate({ period: 20, values: closes });

        // Осцилляторы
        const rsi = RSI.calculate({ period: 14, values: closes });
        const emaRsi = EMA.calculate({ period: 5, values: rsi }); // Сглаженный RSI

        const macd = MACD.calculate({
            fastPeriod: 16,
            slowPeriod: 32,
            signalPeriod: 9,
            values: closes
        });

        // Полосы Боллинджера
        const bb = BollingerBands.calculate({
            period: 20,
            values: closes,
            stdDev: 2
        });

        // Фильтр объема
        const avgVolume = volumes.slice(-50).reduce((sum, vol) => sum + vol, 0) / 50;
        const currentVolume = volumes[volumes.length - 1];
        const isLowVolume = currentVolume < avgVolume * 0.7;

        // Анализ свечных паттернов (последние 3 свечи)
        const recentCloses = closes.slice(-3);
        const recentHighs = highs.slice(-3);
        const recentLows = lows.slice(-3);

        let bullishCandles = 0;
        let bearishCandles = 0;

        // Проверка бычьих и медвежьих свечей
        for (let i = 1; i < recentCloses.length; i++) {
            if (recentCloses[i] > recentCloses[i - 1]) bullishCandles++;
            if (recentCloses[i] < recentCloses[i - 1]) bearishCandles++;
        }

        // Проверка на пин-бары
        const lastCandle = {
            open: closes[closes.length - 2],
            close: closes[closes.length - 1],
            high: highs[highs.length - 1],
            low: lows[lows.length - 1]
        };

        const candleBodySize = Math.abs(lastCandle.close - lastCandle.open);
        const candleTotalSize = lastCandle.high - lastCandle.low;
        const hasPinBar = candleBodySize < candleTotalSize * 0.3;

        let priceAction = "neutral";
        if (bullishCandles >= 2 || (hasPinBar && lastCandle.close > lastCandle.open)) priceAction = "bullish";
        if (bearishCandles >= 2 || (hasPinBar && lastCandle.close < lastCandle.open)) priceAction = "bearish";

        return {
            sma50: sma50[sma50.length - 1],
            sma200: sma200[sma200.length - 1],
            ema20: ema20[ema20.length - 1],
            rsi: rsi[rsi.length - 1],
            emaRsi: emaRsi[emaRsi.length - 1],
            macd: macd[macd.length - 1],
            bollingerBands: bb[bb.length - 1],
            priceAction,
            lastPrice: closes[closes.length - 1],
            isLowVolume,
            hasPinBar
        };
    } catch (error) {
        console.error("Ошибка расчета индикаторов:", error);
        return null;
    }
};

const analyzeEntry = (indicators) => {
    if (!indicators) return { signal: "HOLD", conditionsMet: { bullish: 0, bearish: 0 } };

    const isLowVolume = indicators.isLowVolume;

    const {
        sma50,
        sma200,
        ema20,
        emaRsi,
        macd,
        bollingerBands,
        priceAction,
        lastPrice,
        hasPinBar
    } = indicators;

    // Условия для ПОКУПКИ
    const bullishConditions = [
        ema20 > sma50 && sma50 > sma200, // Ясный восходящий тренд
        lastPrice < bollingerBands.lower || (hasPinBar && priceAction === "bullish"),
        emaRsi < 35, // Используем сглаженный RSI
        macd.histogram > 0.3 && macd.MACD > macd.signal, // Сильный MACD
        priceAction === "bullish",
        lastPrice > ema20 // Цена выше EMA20
    ];

    // Условия для ПРОДАЖИ
    const bearishConditions = [
        ema20 < sma50 && sma50 < sma200, // Ясный нисходящий тренд
        lastPrice > bollingerBands.upper || (hasPinBar && priceAction === "bearish"),
        emaRsi > 65, // Используем сглаженный RSI
        macd.histogram < -0.3 && macd.MACD < macd.signal, // Сильный MACD
        priceAction === "bearish",
        lastPrice < ema20 // Цена ниже EMA20
    ];

    const bullishScore = bullishConditions.filter(cond => cond).length;
    const bearishScore = bearishConditions.filter(cond => cond).length;

    // Всегда возвращаем сигнал, даже если подтверждений мало
    if (bullishScore > bearishScore) return {
        signal: "BUY",
        conditionsMet: {
            bullish: bullishScore,
            bearish: bearishScore,
            total: 6
        }
    };

    if (bearishScore > bullishScore) return {
        signal: "SELL",
        conditionsMet: {
            bullish: bullishScore,
            bearish: bearishScore,
            total: 6
        }
    };

    return {
        signal: "HOLD",
        conditionsMet: {
            bullish: bullishScore,
            bearish: bearishScore,
            total: 6
        }
    };
};

const calculateConfidenceLevel = (indicators, signal, conditionsMet) => {
    const {
        sma50,
        sma200,
        ema20,
        emaRsi,
        macd,
        bollingerBands,
        lastPrice,
        priceAction,
        hasPinBar
    } = indicators;

    let confidenceScore = 0;

    const weights = {
        trend_strength: 25,
        oscillator: 20,
        volatility: 20,
        momentum: 20,
        price_action: 15
    };

    if (signal === "BUY") {
        // Сила тренда
        if (ema20 > sma50 && sma50 > sma200) confidenceScore += weights.trend_strength;
        else if (ema20 > sma50) confidenceScore += weights.trend_strength * 0.7;

        // Осцилляторы
        if (emaRsi < 30) confidenceScore += weights.oscillator;
        else if (emaRsi < 35) confidenceScore += weights.oscillator * 0.8;

        // Волатильность
        if (lastPrice < bollingerBands.lower) confidenceScore += weights.volatility;
        else if (lastPrice < (bollingerBands.lower * 1.01)) confidenceScore += weights.volatility * 0.7;

        // Моментум
        if (macd.histogram > 0.5 && macd.MACD > macd.signal) confidenceScore += weights.momentum;
        else if (macd.histogram > 0.3 && macd.MACD > macd.signal) confidenceScore += weights.momentum * 0.7;

        // Ценовое действие
        if (hasPinBar && priceAction === "bullish") confidenceScore += weights.price_action;
        else if (priceAction === "bullish") confidenceScore += weights.price_action * 0.7;
    }

    if (signal === "SELL") {
        // Сила тренда
        if (ema20 < sma50 && sma50 < sma200) confidenceScore += weights.trend_strength;
        else if (ema20 < sma50) confidenceScore += weights.trend_strength * 0.7;

        // Осцилляторы
        if (emaRsi > 70) confidenceScore += weights.oscillator;
        else if (emaRsi > 65) confidenceScore += weights.oscillator * 0.8;

        // Волатильность
        if (lastPrice > bollingerBands.upper) confidenceScore += weights.volatility;
        else if (lastPrice > (bollingerBands.upper * 0.99)) confidenceScore += weights.volatility * 0.7;

        // Моментум
        if (macd.histogram < -0.5 && macd.MACD < macd.signal) confidenceScore += weights.momentum;
        else if (macd.histogram < -0.3 && macd.MACD < macd.signal) confidenceScore += weights.momentum * 0.7;

        // Ценовое действие
        if (hasPinBar && priceAction === "bearish") confidenceScore += weights.price_action;
        else if (priceAction === "bearish") confidenceScore += weights.price_action * 0.7;
    }

    const totalPossibleScore = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const confidencePercentage = Math.min((confidenceScore / totalPossibleScore) * 100, 100);

    // Включаем фактическое количество выполненных условий
    const activeCount = signal === "BUY" ? conditionsMet.bullish : conditionsMet.bearish;

    return {
        percentage: confidencePercentage.toFixed(2),
        level: confidencePercentage >= 75 ? "ВЫСОКИЙ" :
            confidencePercentage >= 55 ? "СРЕДНИЙ" : "НИЗКИЙ",
        conditionRatio: `${activeCount}/${conditionsMet.total}`,
        recommendation: confidencePercentage >= 70 ? "СИЛЬНЫЙ СИГНАЛ - ХОРОШАЯ ТОЧКА ВХОДА" :
            confidencePercentage >= 50 ? "УМЕРЕННЫЙ СИГНАЛ - БУДЬТЕ ОСТОРОЖНЫ" :
                confidencePercentage >= 30 ? "СЛАБЫЙ СИГНАЛ - ЛУЧШЕ ИЗБЕГАТЬ" :
                    "ОЧЕНЬ СЛАБЫЙ СИГНАЛ - НЕ РЕКОМЕНДУЕТСЯ"
    };
};

const calculateStopLossAndTakeProfit = (entryPrice, signal, symbol, volatility) => {
    // Для криптовалют используем процентные стопы вместо пунктов
    const stopPercentage = volatility * 100 * 1.5; // 1.5x волатильности в процентах
    const targetPercentage = stopPercentage * 2; // Соотношение риск:прибыль 1:2

    // Минимальные значения стопов, чтобы избежать слишком узких стопов
    const minimumStopPercentage = 1.5; // Минимум 1.5%
    const actualStopPercentage = Math.max(stopPercentage, minimumStopPercentage);
    const actualTargetPercentage = actualStopPercentage * 2;

    if (signal === "BUY") {
        return {
            stopLoss: entryPrice * (1 - actualStopPercentage / 100),
            takeProfit: entryPrice * (1 + actualTargetPercentage / 100),
            percentTarget: actualTargetPercentage.toFixed(2),
            stopPercentage: actualStopPercentage.toFixed(2)
        };
    } else if (signal === "SELL") {
        return {
            stopLoss: entryPrice * (1 + actualStopPercentage / 100),
            takeProfit: entryPrice * (1 - actualTargetPercentage / 100),
            percentTarget: actualTargetPercentage.toFixed(2),
            stopPercentage: actualStopPercentage.toFixed(2)
        };
    }
    return { stopLoss: 0, takeProfit: 0, percentTarget: 0, stopPercentage: 0 };
};

export const generateSignals = async (symbol, setCurrentPrices, setSignals) => {
    if (isHighImpactNewsTime()) {
        console.log(`Пропускаем ${symbol} из-за важных новостей`);
        return null;
    }

    try {
        // Сначала обновляем текущую цену
        const currentPrice = await fetchCurrentPrice(symbol);
        if (currentPrice) {
            setCurrentPrices(prev => ({ ...prev, [symbol]: currentPrice }));
        }

        // Получаем исторические данные для анализа
        const historicalData = await fetchHistoricalData(symbol, setCurrentPrices);
        if (!historicalData) return null;

        const indicators = calculateIndicators(historicalData);
        if (!indicators) return null;

        const analysis = analyzeEntry(indicators);
        const signalType = analysis.signal;

        const atr = Math.max(
            Math.max(...historicalData.highs.slice(-14)) - Math.min(...historicalData.lows.slice(-14)),
            0.001
        ) / indicators.lastPrice; // Нормализовано по цене для процентов

        const confidence = calculateConfidenceLevel(indicators, signalType, analysis.conditionsMet);

        const { stopLoss, takeProfit, percentTarget, stopPercentage } = calculateStopLossAndTakeProfit(
            indicators.lastPrice,
            signalType,
            symbol,
            atr
        );

        const signal = {
            symbol,
            signalType,
            timestamp: new Date().toISOString(),
            currentPrice: indicators.lastPrice,
            entryPrice: indicators.lastPrice,
            stopLoss,
            takeProfit,
            percentTarget,
            stopPercentage,
            confidenceLevel: confidence.percentage,
            confidenceText: confidence.level,
            conditionRatio: confidence.conditionRatio,
            recommendation: confidence.recommendation,
            reasons: [],
            indicators: {
                sma50: indicators.sma50,
                sma200: indicators.sma200,
                ema20: indicators.ema20,
                rsi: indicators.emaRsi,
                macd: indicators.macd,
                bb: indicators.bollingerBands
            }
        };

        // Добавляем причины сигнала
        if (signalType === "BUY") {
            if (indicators.ema20 > indicators.sma50 && indicators.sma50 > indicators.sma200)
                signal.reasons.push("Сильный восходящий тренд (EMA20 > SMA50 > SMA200)");
            if (indicators.lastPrice < indicators.bollingerBands.lower)
                signal.reasons.push("Цена ниже нижней полосы Боллинджера");
            if (indicators.emaRsi < 35)
                signal.reasons.push("Перепроданность (Сглаженный RSI < 35)");
            if (indicators.macd.histogram > 0.3 && indicators.macd.MACD > indicators.macd.signal)
                signal.reasons.push("Сильный бычий MACD");
            if (indicators.priceAction === "bullish")
                signal.reasons.push("Бычье ценовое действие");
            if (indicators.hasPinBar)
                signal.reasons.push("Пин-бар у уровня поддержки");
        }
        else if (signalType === "SELL") {
            if (indicators.ema20 < indicators.sma50 && indicators.sma50 < indicators.sma200)
                signal.reasons.push("Сильный нисходящий тренд (EMA20 < SMA50 < SMA200)");
            if (indicators.lastPrice > indicators.bollingerBands.upper)
                signal.reasons.push("Цена выше верхней полосы Боллинджера");
            if (indicators.emaRsi > 65)
                signal.reasons.push("Перекупленность (Сглаженный RSI > 65)");
            if (indicators.macd.histogram < -0.3 && indicators.macd.MACD < indicators.macd.signal)
                signal.reasons.push("Сильный медвежий MACD");
            if (indicators.priceAction === "bearish")
                signal.reasons.push("Медвежье ценовое действие");
            if (indicators.hasPinBar)
                signal.reasons.push("Пин-бар у уровня сопротивления");
        }

        setSignals(prev => ({ ...prev, [symbol]: signal }));

        // Показываем уведомление для сигналов с хотя бы 2 условиями
        if (signalType !== "HOLD") {
            Swal.fire({
                icon: "info",
                title: `Новый сигнал ${signalType} для ${symbol}`,
                html: `
          <div class="text-left">
            <p><strong>Вход:</strong> ${signal.entryPrice.toFixed(symbol.includes("BTC") ? 1 : 4)}</p>
            <p><strong>Стоп-лосс:</strong> ${signal.stopLoss.toFixed(symbol.includes("BTC") ? 1 : 4)}</p>
            <p><strong>Тейк-профит:</strong> ${signal.takeProfit.toFixed(symbol.includes("BTC") ? 1 : 4)}</p>
            <p><strong>Цель:</strong> ${signal.percentTarget}%</p>
            <p><strong>Расстояние до стопа:</strong> ${signal.stopPercentage}%</p>
            <p><strong>Уверенность:</strong> ${signal.confidenceText} (${signal.confidenceLevel}%)</p>
            <p><strong>Условий выполнено:</strong> ${signal.conditionRatio}</p>
            <p><strong>Рекомендация:</strong> ${signal.recommendation}</p>
            <p><strong>Причины:</strong> ${signal.reasons.join(', ')}</p>
          </div>
        `,
                confirmButtonText: "OK"
            });
        }

        return signal;
    } catch (error) {
        console.error(`Ошибка генерации сигналов для ${symbol}:`, error);
        return null;
    }
};

export const TradingSignals = ({ symbols = ["BTC/USDT", "ETH/USDT", "BNB/USDT", "XRP/USDT", "SOL/USDT"] }) => {
    const [currentPrices, setCurrentPrices] = useState({});
    const [signals, setSignals] = useState({});
    const [loading, setLoading] = useState({});
    const [lastUpdate, setLastUpdate] = useState(null);
    const [isNewsTime, setIsNewsTime] = useState(false);

    // Проверка новостного периода каждую минуту
    useEffect(() => {
        const checkNewsTime = () => {
            setIsNewsTime(isHighImpactNewsTime());
        };

        checkNewsTime();
        const interval = setInterval(checkNewsTime, 60000);
        return () => clearInterval(interval);
    }, []);

    const analyzeSymbol = async (symbol) => {
        if (isNewsTime) {
            Swal.fire({
                icon: "warning",
                title: "Новостной период",
                text: "Анализ временно приостановлен из-за важных новостных событий",
                confirmButtonText: "OK"
            });
            return;
        }

        setLoading(prev => ({ ...prev, [symbol]: true }));
        try {
            await generateSignals(symbol, setCurrentPrices, setSignals);
            setLastUpdate(new Date());
        } catch (error) {
            console.error(`Ошибка анализа ${symbol}:`, error);
        } finally {
            setLoading(prev => ({ ...prev, [symbol]: false }));
        }
    };

    const analyzeAllSymbols = async () => {
        if (isNewsTime) {
            Swal.fire({
                icon: "warning",
                title: "Новостной период",
                text: "Анализ временно приостановлен из-за важных новостных событий",
                confirmButtonText: "OK"
            });
            return;
        }

        try {
            const promises = symbols.map(symbol => {
                setLoading(prev => ({ ...prev, [symbol]: true }));
                return generateSignals(symbol, setCurrentPrices, setSignals)
                    .finally(() => setLoading(prev => ({ ...prev, [symbol]: false })));
            });

            await Promise.all(promises);
            setLastUpdate(new Date());
        } catch (error) {
            console.error("Ошибка анализа символов:", error);
        }
    };

    useEffect(() => {
        analyzeAllSymbols();
        const interval = setInterval(() => {
            if (!isNewsTime) analyzeAllSymbols();
        }, 900000); // 15 минут

        return () => clearInterval(interval);
    }, [isNewsTime]);

    // Форматирование цены в зависимости от типа криптовалюты
    const formatPrice = (symbol, price) => {
        if (!price) return '—';

        if (symbol.includes("BTC")) {
            return price.toFixed(1);
        } else if (symbol.includes("ETH") || symbol.includes("BNB")) {
            return price.toFixed(2);
        } else if (symbol.includes("XRP") || symbol.includes("ADA")) {
            return price.toFixed(4);
        } else {
            return price.toFixed(4);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4">
            <div className="flex justify-between items-center flex-wrap gap-[30px] mb-6">
                <h2 className="text-3xl font-bold text-gray-800">Криптотрейдинг сигналы (Binance)</h2>
                {isNewsTime && (
                    <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                        Внимание: Новостной период
                    </span>
                )}
            </div>

            <div className="mb-6 flex justify-between items-center flex-wrap gap-4">
                <div>
                    <button
                        onClick={analyzeAllSymbols}
                        disabled={isNewsTime}
                        className={`bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out ${isNewsTime ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                    >
                        Обновить все сигналы
                    </button>
                    {lastUpdate && (
                        <p className="text-sm text-gray-600 mt-2">
                            Последнее обновление: {lastUpdate.toLocaleTimeString()}
                        </p>
                    )}
                </div>
                <div className="text-sm text-gray-600">
                    <p>Стратегия: EMA20, SMA50/200, RSI, Полосы Боллинджера, MACD, Ценовое действие</p>
                    <p>Управление рисками: соотношение риск/прибыль 1:2, новостной фильтр</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {symbols.map(symbol => (
                    <div key={symbol} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
                        <div className="flex justify-between items-center p-4 bg-gray-50 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-700">{symbol}</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-bold text-gray-800">
                                    {formatPrice(symbol, currentPrices[symbol])}
                                </span>
                                {loading[symbol] && (
                                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                )}
                            </div>
                        </div>

                        <div className="p-4">
                            {signals[symbol] ? (
                                <div className={`rounded-md p-3 ${signals[symbol].signalType === "BUY"
                                    ? "bg-green-50 border-l-4 border-green-500"
                                    : signals[symbol].signalType === "SELL"
                                        ? "bg-red-50 border-l-4 border-red-500"
                                        : "bg-gray-50 border-l-4 border-gray-500"
                                    }`}>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className={`font-semibold ${signals[symbol].signalType === "BUY"
                                            ? "text-green-600"
                                            : signals[symbol].signalType === "SELL"
                                                ? "text-red-600"
                                                : "text-gray-600"
                                            }`}>
                                            {signals[symbol].signalType === "HOLD"
                                                ? "Нет сигнала"
                                                : `Сигнал ${signals[symbol].signalType}`}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {signals[symbol].signalType !== "HOLD" && (
                                                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                                                    {signals[symbol].conditionRatio}
                                                </span>
                                            )}
                                            {signals[symbol].signalType !== "HOLD" && (
                                                <span className={`text-xs px-2 py-1 rounded-full ${signals[symbol].confidenceText === 'ВЫСОКИЙ' ? "bg-green-100 text-green-800" :
                                                    signals[symbol].confidenceText === 'СРЕДНИЙ' ? "bg-yellow-100 text-yellow-800" :
                                                        "bg-red-100 text-red-800"
                                                    }`}>
                                                    {signals[symbol].confidenceLevel}%
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {signals[symbol].signalType !== "HOLD" ? (
                                        <>
                                            <div className="mb-2">
                                                <span className="text-sm font-medium">Уверенность: </span>
                                                <span className={`text-sm ${signals[symbol].confidenceText === 'ВЫСОКИЙ' ? 'text-green-600' :
                                                        signals[symbol].confidenceText === 'СРЕДНИЙ' ? 'text-yellow-600' : 'text-red-600'
                                                    }`}>
                                                    {signals[symbol].confidenceText} ({signals[symbol].confidenceLevel}%)
                                                </span>
                                            </div>

                                            <div className="mb-2">
                                                <span className="text-sm font-medium">Рекомендация: </span>
                                                <span className={`text-sm ${signals[symbol].recommendation.includes('СИЛЬНЫЙ') ? 'text-green-600' :
                                                        signals[symbol].recommendation.includes('УМЕРЕННЫЙ') ? 'text-yellow-600' : 'text-red-600'
                                                    }`}>
                                                    {signals[symbol].recommendation}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 mb-3">
                                                <div className="text-sm">
                                                    <span className="font-medium text-gray-600">Вход:</span> {formatPrice(symbol, signals[symbol].entryPrice)}
                                                </div>
                                                <div className="text-sm">
                                                    <span className="font-medium text-gray-600">Стоп:</span> {formatPrice(symbol, signals[symbol].stopLoss)}
                                                </div>
                                                <div className="text-sm">
                                                    <span className="font-medium text-gray-600">Тейк-профит:</span> {formatPrice(symbol, signals[symbol].takeProfit)}
                                                </div>
                                                <div className="text-sm">
                                                    <span className="font-medium text-gray-600">Цель:</span> {signals[symbol].percentTarget}%
                                                </div>
                                                <div className="text-sm">
                                                    <span className="font-medium text-gray-600">Стоп:</span> {signals[symbol].stopPercentage}%
                                                </div>
                                            </div>

                                            <div className="mt-2">
                                                <p className="text-sm font-medium text-gray-700">Причины:</p>
                                                <ul className="text-sm text-gray-600 pl-4 mt-1 list-disc">
                                                    {signals[symbol].reasons.map((reason, idx) => (
                                                        <li key={idx} className="mt-1">{reason}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center py-2 text-gray-500">
                                            Нет активных торговых сигналов
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    {loading[symbol] ? 'Анализ...' : 'Данные не загружены'}
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
                                {loading[symbol] ? 'Анализ...' : 'Обновить'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};