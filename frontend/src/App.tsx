import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Trade from "./pages/Trade";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AcademyDashboard from "./pages/AcademyDashboard";
import LessonViewer from "./pages/LessonViewer";
import DashboardLayout from "./components/DashboardLayout";
import DashboardHome from "./pages/DashboardHome";
import ProtectedLayout from "./components/ProtectedLayout";
import Placeholder from "./pages/Placeholder";
import FeedPage from "./pages/FeedPage";

function App() {
  const token = localStorage.getItem("amanah_token");

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/trade" element={token ? <Trade /> : <Navigate to="/login" replace />} />
        <Route path="/" element={token ? <ProtectedLayout /> : <Navigate to="/login" replace />}>
          <Route element={<DashboardLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardHome />} />
            <Route path="dashboard/feed" element={<FeedPage />} />
            <Route path="academy" element={<AcademyDashboard />} />
            <Route path="academy/courses" element={<Placeholder title="All Courses" />} />
            <Route path="academy/lessons/:lessonId" element={<LessonViewer />} />
            <Route path="invest" element={<Trade />} />
            <Route path="invest/automated" element={<Placeholder title="Automated Account" />} />
            <Route path="invest/screener" element={<Placeholder title="Stocks Screener" />} />
            <Route path="invest/analytics" element={<Placeholder title="Analytics" />} />
            <Route path="workspace" element={<Placeholder title="Workspace" />} />
            <Route path="community" element={<Placeholder title="Community Chat" />} />
            <Route path="zakat" element={<Placeholder title="Zakat" />} />
            <Route path="profile" element={<Placeholder title="Profile" />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
