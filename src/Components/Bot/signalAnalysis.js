/**
 * Анализ сигнала на вход
 * @param {Object} indicators - Объект с рассчитанными индикаторами
 * @returns {string} - Тип сигнала ("BUY", "SELL" или "HOLD")
 */
export const analyzeEntry = (indicators) => {
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

/**
 * Расчет уровня уверенности в сигнале
 * @param {Object} indicators - Объект с рассчитанными индикаторами
 * @param {string} signal - Тип сигнала ("BUY" или "SELL")
 * @returns {Object} - Объект с процентом и уровнем уверенности
 */
export const calculateConfidenceLevel = (indicators, signal) => {
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

/**
 * Расчет уровней Stop Loss и Take Profit
 * @param {number} entryPrice - Цена входа
 * @param {string} signal - Тип сигнала ("BUY" или "SELL")
 * @param {string} symbol - Торговый символ
 * @returns {Object} - Объект с уровнями Stop Loss и Take Profit
 */
export const calculateStopLossAndTakeProfit = (entryPrice, signal, symbol) => {
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

    return { stopLoss: entryPrice, takeProfit: entryPrice }; // Значения по умолчанию
};