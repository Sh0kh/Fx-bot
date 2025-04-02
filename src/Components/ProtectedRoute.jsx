import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem("token"); // Проверяем наличие токена в localStorage
    if (!token) {
        return <Navigate to="/login" replace />; // Перенаправляем на страницу логина
    }
    return children; // Если токен есть, рендерим дочерний компонент
};

export default ProtectedRoute;