import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Trade from "./pages/Trade";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AcademyDashboard from "./pages/AcademyDashboard";
import LessonViewer from "./pages/LessonViewer";

function App() {
  const token = localStorage.getItem("amanah_token");

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/trade" element={token ? <Trade /> : <Navigate to="/login" replace />} />
        <Route path="/academy" element={token ? <AcademyDashboard /> : <Navigate to="/login" replace />} />
        <Route path="/academy/lessons/:lessonId" element={token ? <LessonViewer /> : <Navigate to="/login" replace />} />
        <Route path="/" element={<Navigate to={token ? "/academy" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
