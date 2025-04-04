import React, { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { SMA, RSI, MACD, EMA, BollingerBands } from "technicalindicators";

// Конфигурация API
const API_KEY = "a9db6b712c1a40299e39d7266af5b2b3";
const BASE_URL = "https://api.twelvedata.com/time_series";
const INTERVAL = "15min";
const OUTPUT_SIZE = 500;

export const fetchHistoricalData = async (symbol, setCurrentPrices) => {
  try {
    const url = `${BASE_URL}?symbol=${symbol}&interval=${INTERVAL}&outputsize=${OUTPUT_SIZE}&apikey=${API_KEY}`;
    const response = await axios.get(url);

    if (response.data.status === "error") {
      throw new Error(response.data.message);
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
    Swal.fire({
      icon: "error",
      title: "Ошибка получения данных",
      text: `Не удалось получить данные для ${symbol}: ${error.message}`,
      confirmButtonText: "OK"
    });
    return null;
  }
};

const calculateIndicators = (data) => {
  if (!data) return null;
  const { closes } = data;

  try {
    // Рассчитываем все индикаторы
    const sma50 = SMA.calculate({ period: 50, values: closes });
    const sma200 = SMA.calculate({ period: 200, values: closes });
    const rsi = RSI.calculate({ period: 14, values: closes });
    const macd = MACD.calculate({
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      values: closes
    });
    const ema20 = EMA.calculate({ period: 20, values: closes });
    const bb = BollingerBands.calculate({
      period: 20,
      values: closes,
      stdDev: 2
    });

    // Анализ ценового действия (последние 3 свечи)
    const recent = closes.slice(-3);
    let bullishCandles = 0;
    let bearishCandles = 0;
    
    for (let i = 1; i < recent.length; i++) {
      if (recent[i] > recent[i-1]) bullishCandles++;
      if (recent[i] < recent[i-1]) bearishCandles++;
    }
    
    let priceAction = "neutral";
    if (bullishCandles >= 2) priceAction = "bullish";
    if (bearishCandles >= 2) priceAction = "bearish";

    return {
      sma50: sma50[sma50.length - 1],
      sma200: sma200[sma200.length - 1],
      rsi: rsi[rsi.length - 1],
      macd: macd[macd.length - 1],
      ema20: ema20[ema20.length - 1],
      bollingerBands: bb[bb.length - 1],
      priceAction,
      lastPrice: closes[closes.length - 1]
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

const analyzeEntry = (indicators) => {
  const { sma50, sma200, rsi, macd, bollingerBands, ema20, priceAction, lastPrice } = indicators;

  // Условия для BUY сигнала
  const bullishConditions = [
    ema20 > sma50,
    lastPrice < bollingerBands.lower,
    rsi < 40,
    macd.histogram > -0.001 && macd.MACD > macd.signal,
    priceAction === "bullish"
  ];

  // Условия для SELL сигнала
  const bearishConditions = [
    ema20 < sma50,
    lastPrice > bollingerBands.upper,
    rsi > 60,
    macd.histogram < 0.001 && macd.MACD < macd.signal,
    priceAction === "bearish"
  ];

  // Требуем только 2 совпадения из 5 условий
  const bullishScore = bullishConditions.filter(cond => cond).length;
  const bearishScore = bearishConditions.filter(cond => cond).length;

  if (bullishScore >= 2) return "BUY";
  if (bearishScore >= 2) return "SELL";
  return "HOLD";
};

const calculateConfidenceLevel = (indicators, signal) => {
  const { sma50, sma200, rsi, macd, bollingerBands, ema20, lastPrice, priceAction } = indicators;
  let confidenceScore = 0;

  const weights = {
    sma_trend: 15,
    ema_trend: 25,
    rsi_range: 20,
    bollinger_bands: 20,
    macd_momentum: 15,
    price_action: 25
  };

  if (signal === "BUY") {
    if (ema20 > sma50) confidenceScore += weights.ema_trend;
    if (sma50 > sma200) confidenceScore += weights.sma_trend * 0.7;
    
    if (rsi < 30) confidenceScore += weights.rsi_range;
    else if (rsi < 40) confidenceScore += weights.rsi_range * 0.8;
    else if (rsi < 45) confidenceScore += weights.rsi_range * 0.5;

    if (lastPrice < bollingerBands.lower) confidenceScore += weights.bollinger_bands;
    else if (lastPrice < (bollingerBands.lower * 1.01)) confidenceScore += weights.bollinger_bands * 0.7;

    if (macd.histogram > 0 && macd.MACD > macd.signal) confidenceScore += weights.macd_momentum;
    else if (macd.histogram > -0.1 && macd.MACD > macd.signal) confidenceScore += weights.macd_momentum * 0.6;

    if (priceAction === "bullish") confidenceScore += weights.price_action;
  }

  if (signal === "SELL") {
    if (ema20 < sma50) confidenceScore += weights.ema_trend;
    if (sma50 < sma200) confidenceScore += weights.sma_trend * 0.7;
    
    if (rsi > 70) confidenceScore += weights.rsi_range;
    else if (rsi > 60) confidenceScore += weights.rsi_range * 0.8;
    else if (rsi > 55) confidenceScore += weights.rsi_range * 0.5;

    if (lastPrice > bollingerBands.upper) confidenceScore += weights.bollinger_bands;
    else if (lastPrice > (bollingerBands.upper * 0.99)) confidenceScore += weights.bollinger_bands * 0.7;

    if (macd.histogram < 0 && macd.MACD < macd.signal) confidenceScore += weights.macd_momentum;
    else if (macd.histogram < 0.1 && macd.MACD < macd.signal) confidenceScore += weights.macd_momentum * 0.6;

    if (priceAction === "bearish") confidenceScore += weights.price_action;
  }

  const totalPossibleScore = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  const confidencePercentage = Math.min((confidenceScore / totalPossibleScore) * 100, 100);

  return {
    percentage: Math.round(confidencePercentage),
    level: confidencePercentage >= 70 ? "HIGH" :
      confidencePercentage >= 50 ? "MEDIUM" : "LOW"
  };
};

const calculateStopLossAndTakeProfit = (entryPrice, signal, symbol) => {
  let pipsValue = symbol.includes("JPY") ? 0.01 : 0.0001;
  const targetPips = 90 * pipsValue;
  const stopPips = 40 * pipsValue;

  if (signal === "BUY") {
    return {
      stopLoss: entryPrice - stopPips,
      takeProfit: entryPrice + targetPips
    };
  } else if (signal === "SELL") {
    return {
      stopLoss: entryPrice + stopPips,
      takeProfit: entryPrice - targetPips
    };
  }
  return { stopLoss: 0, takeProfit: 0 };
};

export const generateSignals = async (symbol, setCurrentPrices, setSignals) => {
  try {
    const historicalData = await fetchHistoricalData(symbol, setCurrentPrices);
    if (!historicalData) return null;

    const indicators = calculateIndicators(historicalData);
    if (!indicators) return null;

    const signalType = analyzeEntry(indicators);
    if (signalType === "HOLD") return null;

    const confidence = calculateConfidenceLevel(indicators, signalType);
    const { stopLoss, takeProfit } = calculateStopLossAndTakeProfit(
      indicators.lastPrice,
      signalType,
      symbol
    );

    const signal = {
      symbol,
      signalType,
      timestamp: new Date().toISOString(),
      currentPrice: indicators.lastPrice,
      entryPrice: indicators.lastPrice,
      stopLoss,
      takeProfit,
      pipsTarget: Math.round(Math.abs(takeProfit - indicators.lastPrice) * (symbol.includes("JPY") ? 100 : 10000)),
      confidenceLevel: confidence.percentage,
      confidenceText: confidence.level,
      reasons: []
    };

    // Добавляем основания для сигнала
    if (signalType === "BUY") {
      if (indicators.ema20 > indicators.sma50) signal.reasons.push("EMA20 > SMA50");
      if (indicators.lastPrice < indicators.bollingerBands.lower) signal.reasons.push("Price below BB lower");
      if (indicators.rsi < 40) signal.reasons.push("RSI < 40");
      if (indicators.macd.histogram > -0.001 && indicators.macd.MACD > indicators.macd.signal) signal.reasons.push("MACD bullish");
      if (indicators.priceAction === "bullish") signal.reasons.push("Bullish price action");
    } else if (signalType === "SELL") {
      if (indicators.ema20 < indicators.sma50) signal.reasons.push("EMA20 < SMA50");
      if (indicators.lastPrice > indicators.bollingerBands.upper) signal.reasons.push("Price above BB upper");
      if (indicators.rsi > 60) signal.reasons.push("RSI > 60");
      if (indicators.macd.histogram < 0.001 && indicators.macd.MACD < indicators.macd.signal) signal.reasons.push("MACD bearish");
      if (indicators.priceAction === "bearish") signal.reasons.push("Bearish price action");
    }

    setSignals(prev => ({ ...prev, [symbol]: signal }));

    Swal.fire({
      icon: "info",
      title: `New ${signalType} signal for ${symbol}`,
      html: `
        <div>
          <p><strong>Entry:</strong> ${signal.entryPrice.toFixed(5)}</p>
          <p><strong>Stop Loss:</strong> ${signal.stopLoss.toFixed(5)}</p>
          <p><strong>Take Profit:</strong> ${signal.takeProfit.toFixed(5)}</p>
          <p><strong>Target:</strong> ${signal.pipsTarget} pips</p>
          <p><strong>Confidence:</strong> ${signal.confidenceText} (${signal.confidenceLevel}%)</p>
          <p><strong>Reasons:</strong> ${signal.reasons.join(', ')}</p>
        </div>
      `,
      confirmButtonText: "OK"
    });

    return signal;
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Signal generation error",
      text: `Error generating signals for ${symbol}: ${error.message}`,
      confirmButtonText: "OK"
    });
    return null;
  }
};

export const TradingSignals = ({ symbols = ["EUR/USD", "GBP/JPY"] }) => {
  const [currentPrices, setCurrentPrices] = useState({});
  const [signals, setSignals] = useState({});
  const [loading, setLoading] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);

  const analyzeSymbol = async (symbol) => {
    setLoading(prev => ({ ...prev, [symbol]: true }));
    try {
      await generateSignals(symbol, setCurrentPrices, setSignals);
      setLastUpdate(new Date());
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Analysis error",
        text: `Error analyzing ${symbol}: ${error.message}`,
        confirmButtonText: "OK"
      });
    } finally {
      setLoading(prev => ({ ...prev, [symbol]: false }));
    }
  };

  const analyzeAllSymbols = async () => {
    try {
      const promises = symbols.map(symbol => {
        setLoading(prev => ({ ...prev, [symbol]: true }));
        return generateSignals(symbol, setCurrentPrices, setSignals)
          .finally(() => setLoading(prev => ({ ...prev, [symbol]: false })));
      });
      
      await Promise.all(promises);
      setLastUpdate(new Date());
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Analysis error",
        text: `Error analyzing symbols: ${error.message}`,
        confirmButtonText: "OK"
      });
    }
  };

  useEffect(() => {
    analyzeAllSymbols();
    const interval = setInterval(() => {
      analyzeAllSymbols();
    }, 900000); // 15 minutes
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Forex Trading Signals</h2>

      <div className="mb-6 flex justify-between items-center flex-wrap gap-[20px]">
        <div>
          <button
            onClick={analyzeAllSymbols}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out"
          >
            Refresh All Signals
          </button>
          {lastUpdate && (
            <p className="text-sm text-gray-600 mt-2">
              Last update: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="text-sm text-gray-600">
          <p>Strategy: EMA20, SMA50/200, RSI, Bollinger Bands, MACD, Price Action</p>
          <p>Risk management: 1:2 risk/reward ratio</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      {signals[symbol].signalType === "HOLD" ? "No Signal" : `${signals[symbol].signalType} Signal`}
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