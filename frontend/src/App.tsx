import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Trade from "./pages/Trade";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AcademyDashboard from "./pages/AcademyDashboard";
import AcademyCourses from "./pages/AcademyCourses";
import AcademyCourseDetail from "./pages/AcademyCourseDetail";
import AcademyProgress from "./pages/AcademyProgress";
import AcademyOnboarding from "./pages/AcademyOnboarding";
import TradingOnboarding from "./pages/TradingOnboarding";
import TradingPortfolio from "./pages/TradingPortfolio";
import StockDetail from "./pages/StockDetail";
import TradingExecution from "./pages/TradingExecution";
import LessonViewer from "./pages/LessonViewer";
import DashboardLayout from "./components/DashboardLayout";
import DashboardHome from "./pages/DashboardHome";
import ProtectedLayout from "./components/ProtectedLayout";
import Placeholder from "./pages/Placeholder";
import FeedPage from "./pages/FeedPage";
import WorkspaceHome from "./pages/WorkspaceHome";
import WorkspaceProject from "./pages/WorkspaceProject";

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
            <Route path="academy/onboarding" element={<AcademyOnboarding />} />
            <Route path="academy/courses" element={<AcademyCourses />} />
            <Route path="academy/course/:id" element={<AcademyCourseDetail />} />
            <Route path="academy/progress" element={<AcademyProgress />} />
            <Route path="academy/lessons/:lessonId" element={<LessonViewer />} />
            <Route path="invest" element={<TradingPortfolio />} />
            <Route path="invest/onboarding" element={<TradingOnboarding />} />
            <Route path="invest/stock/:ticker" element={<StockDetail />} />
            <Route path="invest/trade" element={<TradingExecution />} />
            <Route path="invest/transactions" element={<Placeholder title="Transactions" />} />
            <Route path="invest/automated" element={<Placeholder title="Automated Account" />} />
            <Route path="invest/screener" element={<Placeholder title="Stocks Screener" />} />
            <Route path="invest/analytics" element={<Placeholder title="Analytics" />} />
            <Route path="workspace" element={<WorkspaceHome />} />
            <Route path="workspace/project/:projectId" element={<WorkspaceProject />} />
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
