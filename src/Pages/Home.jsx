import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { fetchHistoricalData } from "./dataService";
import { calculateIndicators } from "./indicators";
import { analyzeEntry, calculateConfidenceLevel, calculateStopLossAndTakeProfit } from "./signalAnalysis";
import SignalCard from "./SignalCards";
import SymbolTag from "./SymbolTag";

const Home = () => {
    const [signals, setSignals] = useState([]);
    const [symbols, setSymbols] = useState(["EUR/USD:FX", "GBP/JPY"]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPrices, setCurrentPrices] = useState({});
    const [lastCheck, setLastCheck] = useState(null);

    useEffect(() => {
        // Инициализация и получение первых данных
        fetchDataAndAnalyze();
        
        // Обновляем данные каждые 15 минут
        const interval = setInterval(fetchDataAndAnalyze, 900000);
        
        return () => clearInterval(interval);
    }, []);

    // Функция для получения данных и анализа
    const fetchDataAndAnalyze = async () => {
        setIsLoading(true);
        const generatedSignals = [];

        for (const symbol of symbols) {
            try {
                // Получаем исторические данные
                const historicalData = await fetchHistoricalData(symbol, setCurrentPrices);
                
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

    // Функция для добавления нового символа
    const handleAddSymbol = () => {
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
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white py-8">
            <div className="w-full max-w-4xl p-6 bg-gray-800 rounded-lg shadow-lg">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-4xl font-bold text-cyan-400">📡 Forex Bot Signals</h2>
                    
                    <div className="flex items-center">
                        <button 
                            onClick={fetchDataAndAnalyze}
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
                            <SymbolTag 
                                key={symbol} 
                                symbol={symbol} 
                                onRemove={() => setSymbols(prev => prev.filter(s => s !== symbol))} 
                            />
                        ))}
                        <button 
                            onClick={handleAddSymbol}
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
                        signals.map((signal, index) => (
                            <SignalCard 
                                key={index} 
                                signal={signal} 
                                onDelete={() => handleDeleteSignal(index)} 
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default Home;