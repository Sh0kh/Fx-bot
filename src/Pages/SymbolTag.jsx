import React from "react";

/**
 * Компонент для отображения тега символа с кнопкой удаления
 * @param {Object} props - Свойства компонента
 * @param {string} props.symbol - Символ
 * @param {Function} props.onRemove - Функция для удаления символа
 * @returns {JSX.Element}
 */
const SymbolTag = ({ symbol, onRemove }) => {
    return (
        <div className="bg-gray-700 px-3 py-1 rounded-full flex items-center">
            <span>{symbol}</span>
            <button
                className="ml-2 text-red-400 hover:text-red-300"
                onClick={onRemove}
            >
                ×
            </button>
        </div>
    );
};

export default SymbolTag;