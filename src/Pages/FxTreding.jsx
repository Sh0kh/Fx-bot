import React, { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { SMA, RSI, MACD, EMA, BollingerBands } from "technicalindicators";

// Конфигурация API
const API_KEY = "a9db6b712c1a40299e39d7266af5b2b3";
const BASE_URL = "https://api.twelvedata.com/time_series";
const INTERVAL = "15min";
const OUTPUT_SIZE = 500;

// Важные новостные события (время UTC)
const HIGH_IMPACT_NEWS = [
  { time: "12:30", title: "US NonFarm Payrolls" },
  { time: "14:00", title: "FOMC Rate Decision" },
  { time: "12:15", title: "ECB Press Conference" }
];

// Проверка на новостной период
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

export const fetchHistoricalData = async (symbol, setCurrentPrices) => {
  try {
    const url = `${BASE_URL}?symbol=${symbol}&interval=${INTERVAL}&outputsize=${OUTPUT_SIZE}&apikey=${API_KEY}`;
    const response = await axios.get(url);

    if (response.data.status === "error" || !response.data.values || response.data.values.length < OUTPUT_SIZE * 0.8) {
      throw new Error(response.data.message || "Недостаточно данных от API");
    }

    const data = response.data.values;
    const closes = data.map(candle => parseFloat(candle.close)).reverse();
    const highs = data.map(candle => parseFloat(candle.high)).reverse();
    const lows = data.map(candle => parseFloat(candle.low)).reverse();
    const volumes = data.map(candle => parseFloat(candle.volume || 0)).reverse();
    const times = data.map(candle => candle.datetime).reverse();

    setCurrentPrices(prev => ({
      ...prev,
      [symbol]: closes[0]
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
    
    // Боллинджер Банды
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
    
    // Проверяем бычьи и медвежьи свечи
    for (let i = 1; i < recentCloses.length; i++) {
      if (recentCloses[i] > recentCloses[i-1]) bullishCandles++;
      if (recentCloses[i] < recentCloses[i-1]) bearishCandles++;
    }
    
    // Проверяем пин-бары
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
  if (!indicators || indicators.isLowVolume) return "HOLD";

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

  // Условия для BUY (требуется 4 из 6)
  const bullishConditions = [
    ema20 > sma50 && sma50 > sma200, // Явный восходящий тренд
    lastPrice < bollingerBands.lower || (hasPinBar && priceAction === "bullish"),
    emaRsi < 35, // Используем сглаженный RSI
    macd.histogram > 0.3 && macd.MACD > macd.signal, // Сильный MACD
    priceAction === "bullish",
    lastPrice > ema20 // Цена выше EMA20
  ];

  // Условия для SELL (требуется 4 из 6)
  const bearishConditions = [
    ema20 < sma50 && sma50 < sma200, // Явный нисходящий тренд
    lastPrice > bollingerBands.upper || (hasPinBar && priceAction === "bearish"),
    emaRsi > 65, // Используем сглаженный RSI
    macd.histogram < -0.3 && macd.MACD < macd.signal, // Сильный MACD
    priceAction === "bearish",
    lastPrice < ema20 // Цена ниже EMA20
  ];

  const bullishScore = bullishConditions.filter(cond => cond).length;
  const bearishScore = bearishConditions.filter(cond => cond).length;

  if (bullishScore >= 4) return "BUY";
  if (bearishScore >= 4) return "SELL";
  return "HOLD";
};

const calculateConfidenceLevel = (indicators, signal) => {
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

  return {
    percentage: Math.round(confidencePercentage),
    level: confidencePercentage >= 75 ? "HIGH" :
           confidencePercentage >= 55 ? "MEDIUM" : "LOW"
  };
};

const calculateStopLossAndTakeProfit = (entryPrice, signal, symbol, volatility) => {
  const isJPY = symbol.includes("JPY");
  const pipSize = isJPY ? 0.01 : 0.0001;
  
  // Динамический расчет на основе волатильности
  const atrMultiplier = volatility > 0.005 ? 1.5 : 2.0;
  const stopPips = Math.round((volatility * atrMultiplier * 10000) / (isJPY ? 1 : 100));
  const targetPips = stopPips * 2; // Риск:прибыль 1:2

  if (signal === "BUY") {
    return {
      stopLoss: entryPrice - (stopPips * pipSize),
      takeProfit: entryPrice + (targetPips * pipSize),
      pips: targetPips
    };
  } else if (signal === "SELL") {
    return {
      stopLoss: entryPrice + (stopPips * pipSize),
      takeProfit: entryPrice - (targetPips * pipSize),
      pips: targetPips
    };
  }
  return { stopLoss: 0, takeProfit: 0, pips: 0 };
};

export const generateSignals = async (symbol, setCurrentPrices, setSignals) => {
  if (isHighImpactNewsTime()) {
    console.log(`Пропуск ${symbol} из-за важных новостей`);
    return null;
  }

  try {
    const historicalData = await fetchHistoricalData(symbol, setCurrentPrices);
    if (!historicalData) return null;

    const indicators = calculateIndicators(historicalData);
    if (!indicators) return null;

    const signalType = analyzeEntry(indicators);
    if (signalType === "HOLD") return null;

    // Расчет волатильности (ATR)
    const atr = Math.max(
      Math.max(...historicalData.highs.slice(-14)) - Math.min(...historicalData.lows.slice(-14)),
      0.001
    );

    const confidence = calculateConfidenceLevel(indicators, signalType);
    if (confidence.level === "LOW") return null; // Игнорируем слабые сигналы

    const { stopLoss, takeProfit, pips } = calculateStopLossAndTakeProfit(
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
      pipsTarget: pips,
      confidenceLevel: confidence.percentage,
      confidenceText: confidence.level,
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

    // Добавление причин сигнала
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
        signal.reasons.push("Пин-бар на поддержке");
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
        signal.reasons.push("Пин-бар на сопротивлении");
    }

    setSignals(prev => ({ ...prev, [symbol]: signal }));

    // Показываем уведомление только для высоковероятных сигналов
    if (confidence.level === "HIGH") {
      Swal.fire({
        icon: "info",
        title: `Новый сигнал ${signalType} для ${symbol}`,
        html: `
          <div class="text-left">
            <p><strong>Вход:</strong> ${signal.entryPrice.toFixed(5)}</p>
            <p><strong>Стоп-лосс:</strong> ${signal.stopLoss.toFixed(5)}</p>
            <p><strong>Тейк-профит:</strong> ${signal.takeProfit.toFixed(5)}</p>
            <p><strong>Цель:</strong> ${signal.pipsTarget} пунктов</p>
            <p><strong>Уверенность:</strong> ${signal.confidenceText} (${signal.confidenceLevel}%)</p>
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

export const TradingSignals = ({ symbols = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "XAU/USD"] }) => {
  const [currentPrices, setCurrentPrices] = useState({});
  const [signals, setSignals] = useState({});
  const [loading, setLoading] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isNewsTime, setIsNewsTime] = useState(false);

  // Проверка новостного времени каждую минуту
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
        text: "Анализ временно приостановлен из-за важных новостей",
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
        text: "Анализ временно приостановлен из-за важных новостей",
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

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex justify-between items-center flex-wrap gap-[30px] mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Forex Trading Signals</h2>
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
            className={`bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out ${
              isNewsTime ? "opacity-50 cursor-not-allowed" : ""
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
          <p>Стратегия: EMA20, SMA50/200, RSI, Bollinger Bands, MACD, Price Action</p>
          <p>Управление рисками: соотношение риск/прибыль 1:2, фильтр новостей</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {symbols.map(symbol => (
          <div key={symbol} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
            <div className="flex justify-between items-center p-4 bg-gray-50 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-700">{symbol}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-gray-800">
                  {currentPrices[symbol] ? currentPrices[symbol].toFixed(5) : '—'}
                </span>
                {loading[symbol] && (
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
            </div>

            <div className="p-4">
              {signals[symbol] ? (
                <div className={`rounded-md p-3 ${
                  signals[symbol].signalType === "BUY"
                    ? "bg-green-50 border-l-4 border-green-500"
                    : signals[symbol].signalType === "SELL"
                    ? "bg-red-50 border-l-4 border-red-500"
                    : "bg-gray-50 border-l-4 border-gray-500"
                }`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`font-semibold ${
                      signals[symbol].signalType === "BUY"
                        ? "text-green-600"
                        : signals[symbol].signalType === "SELL"
                        ? "text-red-600"
                        : "text-gray-600"
                    }`}>
                      {signals[symbol].signalType === "HOLD" 
                        ? "Нет сигнала" 
                        : `Сигнал ${signals[symbol].signalType}`}
                    </span>
                    {signals[symbol].signalType !== "HOLD" && (
                      <span className={`text-xs px-2 py-1 rounded-full ${signals[symbol].confidenceText === 'HIGH' ? "bg-green-100 text-green-800" :
                          signals[symbol].confidenceText === 'MEDIUM' ? "bg-yellow-100 text-yellow-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                        {signals[symbol].confidenceText} ({signals[symbol].confidenceLevel}%)
                      </span>
                    )}
                  </div>

                  {signals[symbol].signalType !== "HOLD" ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="text-sm">
                          <span className="font-medium text-gray-600">Entry:</span> {signals[symbol].entryPrice.toFixed(5)}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium text-gray-600">Stop:</span> {signals[symbol].stopLoss.toFixed(5)}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium text-gray-600">Take Profit:</span> {signals[symbol].takeProfit.toFixed(5)}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium text-gray-600">Pips:</span> {signals[symbol].pipsTarget}
                        </div>
                      </div>

                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-700">Reasons:</p>
                        <ul className="text-sm text-gray-600 pl-4 mt-1 list-disc">
                          {signals[symbol].reasons.map((reason, idx) => (
                            <li key={idx} className="mt-1">{reason}</li>
                          ))}
                        </ul>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-2 text-gray-500">
                      No active trading signals
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {loading[symbol] ? 'Analyzing...' : 'Data not loaded'}
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
                {loading[symbol] ? 'Analyzing...' : 'Refresh'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};