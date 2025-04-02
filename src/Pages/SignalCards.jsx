import React from "react";

/**
 * Компонент для отображения карточки сигнала
 * @param {Object} props - Свойства компонента
 * @param {Object} props.signal - Данные сигнала
 * @param {Function} props.onDelete - Функция для удаления сигнала
 * @returns {JSX.Element}
 */
const SignalCard = ({ signal, onDelete }) => {
    return (
        <div className="p-4 bg-gray-700 rounded-lg shadow-md relative">
            <button
                className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition-colors"
                onClick={onDelete}
            >
                Удалить
            </button>
            <h3 className="text-lg font-semibold text-white">{signal.symbol}</h3>
            <p className={`text-lg ${signal.signal === "BUY" ? "text-green-400" : "text-red-400"}`}>
                {signal.signal}
            </p>
            <p className="text-gray-300">
                📅 Время: {signal.openTime}
            </p>
            <p className="text-gray-300">
                💰 Цена входа: {signal.entryPrice}
            </p>
            <p className="text-gray-300">
                ⛔ Stop Loss: {signal.stopLoss}
            </p>
            <p className="text-gray-300">
                ✅ Take Profit: {signal.takeProfit}
            </p>
            <div className="mt-2">
                <p className="text-gray-300">
                    🔍 Уверенность: {signal.confidence}% ({signal.confidenceLevel})
                </p>
                <div className="w-full bg-gray-600 rounded-full h-2 mt-1">
                    <div
                        className={`h-full rounded-full ${
                            signal.confidenceLevel === "HIGH"
                                ? "bg-green-500"
                                : signal.confidenceLevel === "MEDIUM"
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                        }`}
                        style={{ width: `${signal.confidence}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
};

export default SignalCard;