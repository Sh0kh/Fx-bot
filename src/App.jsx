import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import AppLayout from "./layouts/AppLayout";
import MainLayout from "./layouts/MainLayout";
import Home from "./Pages/Home";
import AdminLayout from "./layouts/AdminLayout";
import ProtectedRoute from "./Components/ProtectedRoute"; // Импорт компонента защиты маршрутов

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
          </Route>
          <Route element={<MainLayout />}>
            <Route index element={<Home />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
