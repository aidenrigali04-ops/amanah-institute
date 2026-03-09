import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import BusinessCourses from "./pages/BusinessCourses";
import AcademyCourseDetail from "./pages/AcademyCourseDetail";
import TradingOverview from "./pages/TradingOverview";
import Payout from "./pages/Payout";
import HomeOverview from "./pages/HomeOverview";
import StocksScreener from "./pages/StocksScreener";
import TradingExecution from "./pages/TradingExecution";
import AcademyLessonView from "./pages/AcademyLessonView";

/** Placeholder for pages not yet implemented. */
function Placeholder({ title }: { title?: string }) {
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui", textAlign: "center" }}>
      <h1>{title || "Amanah Institute"}</h1>
      <p>Page coming soon.</p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Placeholder title="Login" />} />
        <Route path="/register" element={<Placeholder title="Register" />} />
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/academy" replace />} />
          <Route path="academy" element={<BusinessCourses />} />
          <Route path="academy/courses" element={<BusinessCourses />} />
          <Route path="academy/course/:id" element={<AcademyCourseDetail />} />
          <Route path="academy/lessons/:id" element={<AcademyLessonView />} />
          <Route path="dashboard" element={<TradingOverview />} />
          <Route path="payout" element={<Payout />} />
          <Route path="home" element={<HomeOverview />} />
          <Route path="invest" element={<StocksScreener />} />
          <Route path="invest/trade" element={<TradingExecution />} />
        </Route>
        <Route path="*" element={<Placeholder />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
