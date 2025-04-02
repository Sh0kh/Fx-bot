/**
 * Расчет простой скользящей средней (SMA)
 * @param {Array} prices - Массив цен
 * @param {number} period - Период для расчета
 * @returns {number|null} - Значение SMA или null при недостатке данных
 */
export const calculateSMA = (prices, period) => {
    if (prices.length < period) return null;
    
    const sum = prices.slice(0, period).reduce((acc, price) => acc + price, 0);
    return sum / period;
};

/**
 * Расчет экспоненциальной скользящей средней (EMA)
 * @param {Array} prices - Массив цен
 * @param {number} period - Период для расчета
 * @returns {number|null} - Значение EMA или null при недостатке данных
 */
export const calculateEMA = (prices, period) => {
    if (prices.length < period) return null;
    
    const k = 2 / (period + 1);
    let ema = prices.slice(period - 1, prices.length).reduce((acc, price) => acc + price, 0) / period;
    
    for (let i = period - 2; i >= 0; i--) {
        ema = prices[i] * k + ema * (1 - k);
    }
    
    return ema;
};

/**
 * Расчет индекса относительной силы (RSI)
 * @param {Array} prices - Массив цен
 * @param {number} period - Период для расчета
 * @returns {number} - Значение RSI
 */
export const calculateRSI = (prices, period) => {
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

/**
 * Расчет индикатора MACD
 * @param {Array} prices - Массив цен
 * @returns {Object} - Объект с параметрами MACD
 */
export const calculateMACD = (prices) => {
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

/**
 * Расчет полос Боллинджера
 * @param {Array} prices - Массив цен
 * @param {number} period - Период для расчета
 * @returns {Object} - Объект с параметрами полос Боллинджера
 */
export const calculateBollingerBands = (prices, period) => {
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

/**
 * Анализ Price Action
 * @param {Array} closes - Массив цен закрытия
 * @param {Array} highs - Массив максимальных цен
 * @param {Array} lows - Массив минимальных цен
 * @returns {string|null} - Результат анализа или null при недостатке данных
 */
export const analyzePriceAction = (closes, highs, lows) => {
    // Анализ последних 3 свечей
    if (closes.length < 3) return null;
    
    // Проверяем на наличие паттернов бычьего/медвежьего движения
    const bullishCandles = closes.slice(0, 3).filter((close, index) => close > closes[index + 1]).length;
    const bearishCandles = closes.slice(0, 3).filter((close, index) => close < closes[index + 1]).length;
    
    if (bullishCandles >= 2) return "bullish";
    if (bearishCandles >= 2) return "bearish";
    
    return "neutral";
};

/**
 * Расчет всех индикаторов для данных
 * @param {Object} data - Объект с историческими данными
 * @returns {Object|null} - Объект с рассчитанными индикаторами или null при недостатке данных
 */
export const calculateIndicators = (data) => {
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