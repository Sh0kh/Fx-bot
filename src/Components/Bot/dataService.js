import axios from "axios";
import Swal from "sweetalert2"; // Импортируем SweetAlert

// API Конфигурация
const API_KEY = "a9db6b712c1a40299e39d7266af5b2b3";
const BASE_URL = "https://api.twelvedata.com/time_series";
const INTERVAL = "15min";
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