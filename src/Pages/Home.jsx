import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import axios from "axios";

const Home = () => {
    const [signals, setSignals] = useState([]);
    const [symbols, setSymbols] = useState(["EUR/USD:FX", "GBP/JPY", ]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPrices, setCurrentPrices] = useState({});
    const [lastCheck, setLastCheck] = useState(null);

    // API Конфигурация
    const API_KEY = "a9db6b712c1a40299e39d7266af5b2b3";
    const BASE_URL = "https://api.twelvedata.com/time_series";
    const INTERVAL = "15min";
    const OUTPUT_SIZE = 500;

    useEffect(() => {
        // Инициализация и получение первых данных
        fetchDataAndAnalyze();
        
        // Обновляем данные каждые 15 минут
        const interval = setInterval(fetchDataAndAnalyze, 900000);
        
        return () => clearInterval(interval);
    }, []);

    // Функция для запроса данных из API
    const fetchHistoricalData = async (symbol) => {
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
            console.error(`❌ Ошибка получения данных для ${symbol}:`, error.message);
            return null;
        }
    };

    // Функция для расчета индикаторов
    const calculateIndicators = (data) => {
        if (!data || !data.closes || data.closes.length < 200) {
            return null;
        }
        
        const closes = data.closes;
        const lastPrice = closes[0];
        
        // Расчет SMA
        const sma50 = calculateSMA(closes, 50);
        const sma200 = calculateSMA(closes, 200);
        
        // Расчет EMA
        const ema20 = calculateEMA(closes, 20);
        
        // Расчет RSI
        const rsi = calculateRSI(closes, 14);
        
        // Расчет MACD
        const macd = calculateMACD(closes);
        
        // Расчет Bollinger Bands
        const bollingerBands = calculateBollingerBands(closes, 20);
        
        // Анализ Price Action
        const priceAction = analyzePriceAction(closes, data.highs, data.lows);
        
        return {
            lastPrice,
            sma50,
            sma200,
            ema20,
            rsi,
            macd,
            bollingerBands,
            priceAction
        };
    };

    // Вспомогательные функции для расчета индикаторов
    const calculateSMA = (prices, period) => {
        if (prices.length < period) return null;
        
        const sum = prices.slice(0, period).reduce((acc, price) => acc + price, 0);
        return sum / period;
    };
    
    const calculateEMA = (prices, period) => {
        if (prices.length < period) return null;
        
        const k = 2 / (period + 1);
        let ema = prices.slice(period - 1, prices.length).reduce((acc, price) => acc + price, 0) / period;
        
        for (let i = period - 2; i >= 0; i--) {
            ema = prices[i] * k + ema * (1 - k);
        }
        
        return ema;
    };
    
    const calculateRSI = (prices, period) => {
        if (prices.length <= period) return 50; // Значение по умолчанию
        
        let gains = 0;
        let losses = 0;
        
        for (let i = 1; i <= period; i++) {
            const change = prices[i-1] - prices[i];
            if (change >= 0) {
                gains += change;
            } else {
                losses -= change;
            }
        }
        
        if (losses === 0) return 100;
        
        const rs = gains / losses;
        return 100 - (100 / (1 + rs));
    };
    
    const calculateMACD = (prices) => {
        const fastEMA = calculateEMA(prices, 12);
        const slowEMA = calculateEMA(prices, 26);
        const macdLine = fastEMA - slowEMA;
        const signalLine = calculateEMA([...prices.slice(0, 9).map(() => macdLine), ...prices.slice(9)], 9);
        const histogram = macdLine - signalLine;
        
        return {
            MACD: macdLine,
            signal: signalLine,
            histogram
        };
    };
    
    const calculateBollingerBands = (prices, period) => {
        const sma = calculateSMA(prices, period);
        
        let sumOfSquaredDeviations = 0;
        for (let i = 0; i < period; i++) {
            sumOfSquaredDeviations += Math.pow(prices[i] - sma, 2);
        }
        
        const standardDeviation = Math.sqrt(sumOfSquaredDeviations / period);
        
        return {
            middle: sma,
            upper: sma + 2 * standardDeviation,
            lower: sma - 2 * standardDeviation
        };
    };
    
    const analyzePriceAction = (closes, highs, lows) => {
        // Анализ последних 3 свечей
        if (closes.length < 3) return null;
        
        // Проверяем на наличие паттернов бычьего/медвежьего движения
        const bullishCandles = closes.slice(0, 3).filter((close, index) => close > closes[index + 1]).length;
        const bearishCandles = closes.slice(0, 3).filter((close, index) => close < closes[index + 1]).length;
        
        if (bullishCandles >= 2) return "bullish";
        if (bearishCandles >= 2) return "bearish";
        
        return "neutral";
    };

    // Функция анализа входа (копия из бэкенда)
    const analyzeEntry = (indicators) => {
        const { sma50, sma200, rsi, macd, bollingerBands, ema20, priceAction, lastPrice } = indicators;

        // Новые условия для краткосрочных движений
        const bullishConditions = [
            ema20 > sma50, // Краткосрочный тренд выше среднесрочного
            lastPrice < bollingerBands.lower, // Цена ниже нижней полосы Боллинджера (перепродано)
            rsi < 40, // Расширен диапазон RSI для более частых сигналов
            macd.histogram > -0.001 && macd.MACD > macd.signal, // MACD готов к развороту вверх
            priceAction === "bullish" // Последние свечи показывают бычий импульс
        ];

        const bearishConditions = [
            ema20 < sma50, // Краткосрочный тренд ниже среднесрочного
            lastPrice > bollingerBands.upper, // Цена выше верхней полосы Боллинджера (перекуплено)
            rsi > 60, // Расширен диапазон RSI для более частых сигналов
            macd.histogram < 0.001 && macd.MACD < macd.signal, // MACD готов к развороту вниз
            priceAction === "bearish" // Последние свечи показывают медвежий импульс
        ];

        // Понижаем требования для входа (требуем меньше совпадающих условий)
        const bullishScore = bullishConditions.filter(cond => cond).length;
        const bearishScore = bearishConditions.filter(cond => cond).length;

        if (bullishScore >= 2) return "BUY";
        if (bearishScore >= 2) return "SELL";

        return "HOLD";
    };

    // Функция расчета уровня уверенности (копия из бэкенда)
    const calculateConfidenceLevel = (indicators, signal) => {
        const { sma50, sma200, rsi, macd, bollingerBands, ema20, lastPrice, priceAction } = indicators;
        let confidenceScore = 0;

        // Веса для каждого индикатора - перераспределены для краткосрочной торговли
        const weights = {
            sma_trend: 15,
            ema_trend: 25,
            rsi_range: 20,
            bollinger_bands: 20,
            macd_momentum: 15,
            price_action: 25
        };

        // Расчет уверенности для BUY сигнала
        if (signal === "BUY") {
            // EMA/SMA тренд
            if (ema20 > sma50) {
                confidenceScore += weights.ema_trend;
            }

            if (sma50 > sma200) {
                confidenceScore += weights.sma_trend * 0.7; // Снижаем значимость долгосрочного тренда
            }

            // RSI диапазон - расширяем для более частых сигналов
            if (rsi < 30) {
                confidenceScore += weights.rsi_range;
            } else if (rsi < 40) {
                confidenceScore += weights.rsi_range * 0.8;
            } else if (rsi < 45) {
                confidenceScore += weights.rsi_range * 0.5;
            }

            // Bollinger Bands
            if (lastPrice < bollingerBands.lower) {
                confidenceScore += weights.bollinger_bands;
            } else if (lastPrice < (bollingerBands.lower * 1.01)) {
                confidenceScore += weights.bollinger_bands * 0.7;
            }

            // MACD импульс
            if (macd.histogram > 0 && macd.MACD > macd.signal) {
                confidenceScore += weights.macd_momentum;
            } else if (macd.histogram > -0.1 && macd.MACD > macd.signal) {
                confidenceScore += weights.macd_momentum * 0.6;
            }

            // Ценовое действие
            if (priceAction === "bullish") {
                confidenceScore += weights.price_action;
            }
        }

        // Расчет уверенности для SELL сигнала
        if (signal === "SELL") {
            // EMA/SMA тренд
            if (ema20 < sma50) {
                confidenceScore += weights.ema_trend;
            }

            if (sma50 < sma200) {
                confidenceScore += weights.sma_trend * 0.7; // Снижаем значимость долгосрочного тренда
            }

            // RSI диапазон - расширяем для более частых сигналов
            if (rsi > 70) {
                confidenceScore += weights.rsi_range;
            } else if (rsi > 60) {
                confidenceScore += weights.rsi_range * 0.8;
            } else if (rsi > 55) {
                confidenceScore += weights.rsi_range * 0.5;
            }

            // Bollinger Bands
            if (lastPrice > bollingerBands.upper) {
                confidenceScore += weights.bollinger_bands;
            } else if (lastPrice > (bollingerBands.upper * 0.99)) {
                confidenceScore += weights.bollinger_bands * 0.7;
            }

            // MACD импульс
            if (macd.histogram < 0 && macd.MACD < macd.signal) {
                confidenceScore += weights.macd_momentum;
            } else if (macd.histogram < 0.1 && macd.MACD < macd.signal) {
                confidenceScore += weights.macd_momentum * 0.6;
            }

            // Ценовое действие
            if (priceAction === "bearish") {
                confidenceScore += weights.price_action;
            }
        }

        // Вычисление процента уверенности
        const totalPossibleScore = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
        const confidencePercentage = Math.min((confidenceScore / totalPossibleScore) * 100, 100);

        return {
            percentage: Math.round(confidencePercentage),
            level: confidencePercentage >= 70 ? "HIGH" :
                confidencePercentage >= 50 ? "MEDIUM" : "LOW"
        };
    };

    // Функция расчета Stop Loss и Take Profit (копия из бэкенда)
    const calculateStopLossAndTakeProfit = (entryPrice, signal, symbol) => {
        // Адаптируем значения для разных типов активов
        let pipsValue = 0.001; // По умолчанию для криптовалют

        // Настройка для форекс-пар
        if (symbol.includes("USD") && !symbol.includes("USDT")) {
            pipsValue = 0.0001; // Значение пункта для форекс-пар
        }

        // Настройка для золота
        if (symbol === "XAUUSD") {
            pipsValue = 0.1; // Значение пункта для золота
        }

        // Целевое движение ~80-100 пунктов
        const targetPips = 90 * pipsValue;
        const stopPips = 40 * pipsValue; // Ставим стоп поближе для лучшего соотношения риск/доходность

        if (signal === "BUY") {
            const stopLoss = parseFloat((entryPrice - stopPips).toFixed(5));
            const takeProfit = parseFloat((entryPrice + targetPips).toFixed(5));
            return { stopLoss, takeProfit };
        } else if (signal === "SELL") {
            const stopLoss = parseFloat((entryPrice + stopPips).toFixed(5));
            const takeProfit = parseFloat((entryPrice - targetPips).toFixed(5));
            return { stopLoss, takeProfit };
        }
    };

    // Функция для получения данных и анализа
    const fetchDataAndAnalyze = async () => {
        setIsLoading(true);
        const generatedSignals = [];

        for (const symbol of symbols) {
            try {
                // Получаем исторические данные
                const historicalData = await fetchHistoricalData(symbol);
                
                if (!historicalData) continue;

                // Вычисляем индикаторы
                const indicators = calculateIndicators(historicalData);
                
                if (!indicators) continue;

                // Анализируем вход
                const signalType = analyzeEntry(indicators);

                if (signalType !== "HOLD") {
                    const confidenceLevel = calculateConfidenceLevel(indicators, signalType);
                    const { stopLoss, takeProfit } = calculateStopLossAndTakeProfit(indicators.lastPrice, signalType, symbol);

                    const newSignal = {
                        symbol,
                        signal: signalType,
                        entryPrice: indicators.lastPrice.toFixed(5),
                        stopLoss: stopLoss.toFixed(5),
                        takeProfit: takeProfit.toFixed(5),
                        confidence: confidenceLevel.percentage,
                        confidenceLevel: confidenceLevel.level,
                        timestamp: new Date().getTime(),
                        openTime: new Date().toLocaleString()
                    };

                    // Проверяем, нет ли уже такого сигнала
                    const existingSignal = signals.find(s => 
                        s.symbol === symbol && 
                        s.signal === signalType && 
                        Math.abs(new Date().getTime() - s.timestamp) < 3600000 // Проверяем, был ли сигнал в последний час
                    );

                    if (!existingSignal) {
                        generatedSignals.push(newSignal);
                    }
                }
            } catch (error) {
                console.error(`❌ Ошибка при генерации сигналов для ${symbol}:`, error.message);
            }
        }

        // Добавляем все новые сигналы
        if (generatedSignals.length > 0) {
            setSignals(prev => [...generatedSignals, ...prev]);
            
            // Показываем уведомления для каждого нового сигнала
            generatedSignals.forEach(signal => {
                showSignalNotification(signal);
            });
        }

        setLastCheck(new Date().toLocaleString());
        setIsLoading(false);
    };

    // Показать уведомление о новом сигнале
    const showSignalNotification = (data) => {
        Swal.fire({
            title: `📈 Новый сигнал: ${data.signal}`,
            html: `
                <p><strong>Символ:</strong> ${data.symbol}</p>
                <p><strong>Цена входа:</strong> ${data.entryPrice}</p>
                <p><strong>Stop Loss:</strong> ${data.stopLoss}</p>
                <p><strong>Take Profit:</strong> ${data.takeProfit}</p>
                <p><strong>Уверенность:</strong> ${data.confidence}% (${data.confidenceLevel})</p>
                <p><strong>Время:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
            `,
            icon: "info",
            confirmButtonColor: "#3085d6",
            background: "#1e1e1e",
            color: "#ffffff",
        });
    };

    // Функция для удаления сигнала
    const handleDeleteSignal = (index) => {
        Swal.fire({
            title: "Вы уверены?",
            text: "Это действие удалит сигнал из списка.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6",
            confirmButtonText: "Да, удалить!",
            cancelButtonText: "Отмена",
            background: "#1e1e1e",
            color: "#ffffff",
        }).then((result) => {
            if (result.isConfirmed) {
                setSignals((prevSignals) =>
                    prevSignals.filter((_, i) => i !== index)
                );
                Swal.fire({
                    title: "Удалено!",
                    text: "Сигнал успешно удален.",
                    icon: "success",
                    background: "#1e1e1e", 
                    color: "#ffffff",
                });
            }
        });
    };

    // Функция для принудительного обновления данных
    const handleForceRefresh = () => {
        fetchDataAndAnalyze();
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white py-8">
            <div className="w-full max-w-4xl p-6 bg-gray-800 rounded-lg shadow-lg">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-4xl font-bold text-cyan-400">📡 Forex Bot Signals</h2>
                    
                    <div className="flex items-center">
                        <button 
                            onClick={handleForceRefresh}
                            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span>Обновление...</span>
                            ) : (
                                <>
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                    </svg>
                                    Обновить
                                </>
                            )}
                        </button>
                    </div>
                </div>
                
                {lastCheck && (
                    <p className="text-gray-400 mb-4">Последнее обновление: {lastCheck}</p>
                )}
                
                {/* Секция текущих котировок */}
                <div className="mb-6">
                    <h3 className="text-xl font-semibold text-cyan-300 mb-3">Текущие котировки:</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {symbols.map(symbol => (
                            <div key={symbol} className="bg-gray-700 p-3 rounded-lg">
                                <p className="font-bold">{symbol}</p>
                                <p className="text-lg">{currentPrices[symbol]?.toFixed(5) || "Загрузка..."}</p>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* Настройки символов */}
                <div className="mb-6">
                    <h3 className="text-xl font-semibold text-cyan-300 mb-3">Настройки:</h3>
                    <div className="flex flex-wrap gap-2">
                        {symbols.map(symbol => (
                            <div key={symbol} className="bg-gray-700 px-3 py-1 rounded-full flex items-center">
                                <span>{symbol}</span>
                                <button 
                                    className="ml-2 text-red-400 hover:text-red-300"
                                    onClick={() => setSymbols(prev => prev.filter(s => s !== symbol))}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                        <button 
                            onClick={() => {
                                Swal.fire({
                                    title: "Добавить символ",
                                    input: "text",
                                    inputPlaceholder: "Например: EUR/USD",
                                    showCancelButton: true,
                                    confirmButtonText: "Добавить",
                                    cancelButtonText: "Отмена",
                                    background: "#1e1e1e",
                                    color: "#ffffff",
                                    inputValidator: (value) => {
                                        if (!value) {
                                            return "Пожалуйста, введите символ";
                                        }
                                        if (symbols.includes(value)) {
                                            return "Этот символ уже добавлен";
                                        }
                                    }
                                }).then(result => {
                                    if (result.isConfirmed && result.value) {
                                        setSymbols(prev => [...prev, result.value]);
                                    }
                                });
                            }}
                            className="bg-gray-700 px-3 py-1 rounded-full hover:bg-gray-600"
                        >
                            + Добавить символ
                        </button>
                    </div>
                </div>
                
                {/* Секция сигналов */}
                <h3 className="text-xl font-semibold text-cyan-300 mb-3">Сигналы:</h3>
                <div className="space-y-4">
                    {signals.length === 0 ? (
                        <p className="text-xl text-gray-400 text-center">⏳ Ожидание сигналов...</p>
                    ) : (
                        signals.map((item, index) => (
                            <div key={index} className="p-4 bg-gray-700 rounded-lg shadow-md relative">
                                <button
                                    className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition-colors"
                                    onClick={() => handleDeleteSignal(index)}
                                >
                                    Удалить
                                </button>
                                <h3 className="text-lg font-semibold text-white">{item.symbol}</h3>
                                <p className={`text-lg ${item.signal === "BUY" ? "text-green-400" : "text-red-400"}`}>
                                    {item.signal}
                                </p>
                                <p className="text-gray-300">
                                    📅 Время: {item.openTime}
                                </p>
                                <p className="text-gray-300">
                                    💰 Цена входа: {item.entryPrice}
                                </p>
                                <p className="text-gray-300">
                                    ⛔ Stop Loss: {item.stopLoss}
                                </p>
                                <p className="text-gray-300">
                                    ✅ Take Profit: {item.takeProfit}
                                </p>
                                <div className="mt-2">
                                    <p className="text-gray-300">
                                        🔍 Уверенность: {item.confidence}% ({item.confidenceLevel})
                                    </p>
                                    <div className="w-full bg-gray-600 rounded-full h-2 mt-1">
                                        <div
                                            className={`h-full rounded-full ${
                                                item.confidenceLevel === "HIGH"
                                                    ? "bg-green-500"
                                                    : item.confidenceLevel === "MEDIUM"
                                                        ? "bg-yellow-500"
                                                        : "bg-red-500"
                                            }`}
                                            style={{ width: `${item.confidence}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default Home;