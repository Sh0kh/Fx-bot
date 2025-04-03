import React, { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2"; // Импортируем SweetAlert

// API Конфигурация
const API_KEY = "a9db6b712c1a40299e39d7266af5b2b3";
const BASE_URL = "https://api.twelvedata.com/time_series";
const INTERVAL = "5min";
const OUTPUT_SIZE = 500;

/**
 * Функция для запроса исторических данных из API
 * @param {string} symbol - Торговый символ
 * @param {function} setCurrentPrices - Функция для установки текущих цен
 * @returns {Object|null} - Обработанные данные или null при ошибке
 */
export const fetchHistoricalData = async (symbol, setCurrentPrices) => {
    try {
        const url = `${BASE_URL}?symbol=${symbol}&interval=${INTERVAL}&outputsize=${OUTPUT_SIZE}&apikey=${API_KEY}`;
        const response = await axios.get(url);

        if (response.data.status === "error") {
            throw new Error(response.data.message);
        }

        const data = response.data.values;

        // Обновляем текущую цену 
        setCurrentPrices(prevPrices => ({
            ...prevPrices,
            [symbol]: parseFloat(data[0].close)
        }));

        // Возвращаем данные в том же формате, что и в бэкенде
        return {
            symbol,
            closes: data.map(candle => parseFloat(candle.close)),
            highs: data.map(candle => parseFloat(candle.high)),
            lows: data.map(candle => parseFloat(candle.low)),
            times: data.map(candle => candle.datetime)
        };
    } catch (error) {
        // Выводим ошибку через SweetAlert
        Swal.fire({
            icon: "error",
            title: "Ошибка получения данных",
            text: `Не удалось получить данные для ${symbol}: ${error.message}`,
            confirmButtonText: "OK"
        });

        return null;
    }
};

/**
 * Расчет индикаторов для анализа
 * @param {Object} data - Исторические данные
 * @returns {Object} - Рассчитанные индикаторы
 */
export const calculateIndicators = (data) => {
    if (!data) return null;

    const { closes, highs, lows } = data;

    try {
        // Расчет EMA
        const calculateEMA = (prices, period) => {
            const k = 2 / (period + 1);
            let ema = [prices[0]];

            for (let i = 1; i < prices.length; i++) {
                ema.push(prices[i] * k + ema[i - 1] * (1 - k));
            }

            return ema;
        };

        // Расчет RSI
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

        // Расчет Bollinger Bands
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

        // Расчет уровней поддержки и сопротивления
        const findSupportResistance = (highs, lows, closes, window = 10) => {
            const supportLevels = [];
            const resistanceLevels = [];

            for (let i = window; i < closes.length - window; i++) {
                const leftPrices = closes.slice(i - window, i);
                const rightPrices = closes.slice(i + 1, i + window + 1);
                const currentLow = lows[i];
                const currentHigh = highs[i];

                // Проверка на поддержку
                if (leftPrices.every(p => p >= currentLow) && rightPrices.every(p => p >= currentLow)) {
                    supportLevels.push({ index: i, level: currentLow });
                }

                // Проверка на сопротивление
                if (leftPrices.every(p => p <= currentHigh) && rightPrices.every(p => p <= currentHigh)) {
                    resistanceLevels.push({ index: i, level: currentHigh });
                }
            }

            return { supportLevels, resistanceLevels };
        };

        // Вычисляем индикаторы
        const ema50 = calculateEMA(closes, 50);
        const ema200 = calculateEMA(closes, 200);
        const rsi = calculateRSI(closes);
        const bollingerBands = calculateBollingerBands(closes);
        const supportResistance = findSupportResistance(highs, lows, closes);

        return {
            ema50,
            ema200,
            rsi,
            bollingerBands,
            supportResistance
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

/**
 * Генерация торговых сигналов на основе рассчитанных индикаторов
 * @param {Object} data - Исторические данные
 * @param {Object} indicators - Рассчитанные индикаторы
 * @returns {Object} - Торговый сигнал
 */
export const generateSignals = (data, indicators) => {
    if (!data || !indicators) return null;

    try {
        const { closes, highs, lows, times, symbol } = data;
        const { ema50, ema200, rsi, bollingerBands, supportResistance } = indicators;

        // ИСПРАВЛЕНО: Получаем текущие значения (индекс 0 - это самая последняя свеча)
        const currentClose = closes[0];
        const currentHigh = highs[0];
        const currentLow = lows[0];
        const currentEMA50 = ema50[0];
        const currentEMA200 = ema200[0];
        const currentRSI = rsi[0] || 50; // Используем значение по умолчанию, если RSI не рассчитан

        // ИСПРАВЛЕНО: Проверяем наличие Bollinger Bands для текущей свечи
        const currentBB = bollingerBands[bollingerBands.length - 1] || { upper: currentClose * 1.01, middle: currentClose, lower: currentClose * 0.99 };

        let signalType = "NEUTRAL"; // BUY, SELL или NEUTRAL
        let entryPrice = 0;
        let stopLoss = 0;
        let takeProfit = 0;
        let confidenceLevel = 0; // 0-100%
        let confidenceText = ""; // High или Low
        let reasons = [];

        // УПРОЩЕННАЯ СТРАТЕГИЯ

        // 1. Основные сигналы - простые условия
        const isEMAUptrend = currentEMA50 > currentEMA200;
        const isEMADowntrend = currentEMA50 < currentEMA200;
        const isOversold = currentRSI !== null && currentRSI < 30;
        const isOverbought = currentRSI !== null && currentRSI > 70;
        const isBelowLowerBB = currentClose < currentBB.lower;
        const isAboveUpperBB = currentClose > currentBB.upper;

        // 2. Находим ближайшие уровни поддержки и сопротивления
        const nearestSupport = supportResistance.supportLevels.length > 0
            ? supportResistance.supportLevels.sort((a, b) =>
                Math.abs(currentClose - a.level) - Math.abs(currentClose - b.level)
            )[0].level
            : currentLow * 0.99;

        const nearestResistance = supportResistance.resistanceLevels.length > 0
            ? supportResistance.resistanceLevels.sort((a, b) =>
                Math.abs(currentClose - a.level) - Math.abs(currentClose - b.level)
            )[0].level
            : currentHigh * 1.01;

        // BUY сигнал - упрощенные условия
        if ((isEMAUptrend && isOversold) || (isBelowLowerBB && currentClose < nearestSupport * 1.01)) {
            signalType = "BUY";
            entryPrice = currentClose;
            stopLoss = Math.min(currentLow, nearestSupport) * 0.998; // Стоп на 0.2% ниже
            takeProfit = currentClose + (currentClose - stopLoss) * 2; // Соотношение риск/прибыль 1:2

            // Расчет уровня доверия
            confidenceLevel = 50; // Базовый уровень

            if (isEMAUptrend) confidenceLevel += 15;
            if (isOversold) confidenceLevel += 15;
            if (isBelowLowerBB) confidenceLevel += 15;
            if (currentClose < nearestSupport * 1.01) confidenceLevel += 15;

            // Причины сигнала
            reasons = [
                isEMAUptrend ? "Восходящий тренд (EMA50 > EMA200)" : "",
                isOversold ? "Перепроданность (RSI < 30)" : "",
                isBelowLowerBB ? "Цена ниже нижней полосы Боллинджера" : "",
                currentClose < nearestSupport * 1.01 ? "Близко к уровню поддержки" : ""
            ].filter(r => r);
        }

        // SELL сигнал - упрощенные условия
        else if ((isEMADowntrend && isOverbought) || (isAboveUpperBB && currentClose > nearestResistance * 0.99)) {
            signalType = "SELL";
            entryPrice = currentClose;
            stopLoss = Math.max(currentHigh, nearestResistance) * 1.002; // Стоп на 0.2% выше
            takeProfit = currentClose - (stopLoss - currentClose) * 2; // Соотношение риск/прибыль 1:2

            // Расчет уровня доверия
            confidenceLevel = 50; // Базовый уровень

            if (isEMADowntrend) confidenceLevel += 15;
            if (isOverbought) confidenceLevel += 15;
            if (isAboveUpperBB) confidenceLevel += 15;
            if (currentClose > nearestResistance * 0.99) confidenceLevel += 15;

            // Причины сигнала
            reasons = [
                isEMADowntrend ? "Нисходящий тренд (EMA50 < EMA200)" : "",
                isOverbought ? "Перекупленность (RSI > 70)" : "",
                isAboveUpperBB ? "Цена выше верхней полосы Боллинджера" : "",
                currentClose > nearestResistance * 0.99 ? "Близко к уровню сопротивления" : ""
            ].filter(r => r);
        }

        // Ограничиваем уровень доверия до 100%
        confidenceLevel = Math.min(confidenceLevel, 100);

        // Определение текстового уровня уверенности
        confidenceText = confidenceLevel >= 70 ? "High" : "Low";

        // Расчет целевого количества пунктов
        let pipsTarget = 0;
        if (signalType !== "NEUTRAL") {
            // Преобразуем разницу цен в пункты (для пар с USD обычно 0.0001 = 1 пункт, для пар с JPY 0.01 = 1 пункт)
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

/**
 * Основная функция для анализа и генерации сигналов
 * @param {string} symbol - Торговый символ
 * @param {function} setCurrentPrices - Функция для установки текущих цен
 * @param {function} setSignals - Функция для обновления сигналов
 * @returns {Promise<void>}
 */
export const analyzeAndGenerateSignals = async (symbol, setCurrentPrices, setSignals) => {
    try {
        // Получаем исторические данные
        const historicalData = await fetchHistoricalData(symbol, setCurrentPrices);

        if (!historicalData) return;

        // Рассчитываем индикаторы
        const indicators = calculateIndicators(historicalData);

        if (!indicators) return;

        // Генерируем сигналы
        const signal = generateSignals(historicalData, indicators);

        if (!signal) return;

        // Обновляем состояние сигналов
        if (signal.signalType !== "NEUTRAL") {
            setSignals(prev => ({
                ...prev,
                [symbol]: signal
            }));

            // Показываем уведомление о новом сигнале
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
                    </div>
                `,
                confirmButtonText: "OK"
            });
        } else {
            // ДОБАВЛЕНО: Уведомление о нейтральном сигнале
            console.log(`Нейтральный сигнал для ${symbol}. Нет рекомендаций для входа.`);
        }

        return signal;
    } catch (error) {
        console.error("Ошибка при анализе и генерации сигналов:", error);

        Swal.fire({
            icon: "error",
            title: "Ошибка анализа",
            text: `Не удалось проанализировать данные для ${symbol}: ${error.message}`,
            confirmButtonText: "OK"
        });
        return null;
    }
};

/**
 * Компонент для отображения и управления сигналами
 */
export const TradingSignals = ({ symbols = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD"] }) => {
    const [currentPrices, setCurrentPrices] = useState({});
    const [signals, setSignals] = useState({});
    const [loading, setLoading] = useState({});

    // Функция для запуска анализа по одному символу
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

    // Функция для запуска анализа по всем символам
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

    // Отображение компонента с использованием Tailwind CSS
    return (
        <div className="max-w-6xl mx-auto p-4">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">FX Торговые Сигналы</h2>

            <div className="mb-6">
                <button
                    onClick={analyzeAllSymbols}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out"
                >
                    Проанализировать все символы
                </button>
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
                                        <span className={`text-xs px-2 py-1 rounded-full ${signals[symbol].confidenceText === "High"
                                            ? "bg-green-100 text-green-800"
                                            : "bg-yellow-100 text-yellow-800"
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