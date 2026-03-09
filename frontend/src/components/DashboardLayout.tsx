import { Outlet, NavLink } from "react-router-dom";
import "./DashboardLayout.css";

export default function DashboardLayout() {
  return (
    <div className="dashboard-layout">
      <header className="dl-header">
        <NavLink to="/" className="dl-logo">Amanah Institute</NavLink>
        <nav className="dl-nav">
          <NavLink to="/home" className={({ isActive }) => isActive ? "dl-link dl-link--active" : "dl-link"}>Home</NavLink>
          <NavLink to="/academy" className={({ isActive }) => isActive ? "dl-link dl-link--active" : "dl-link"}>Academy</NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? "dl-link dl-link--active" : "dl-link"}>Investing</NavLink>
          <NavLink to="/invest" className={({ isActive }) => isActive ? "dl-link dl-link--active" : "dl-link"}>Stocks</NavLink>
          <NavLink to="/payout" className={({ isActive }) => isActive ? "dl-link dl-link--active" : "dl-link"}>Payout</NavLink>
        </nav>
      </header>
      <main className="dl-main">
        <Outlet />
      </main>
    </div>
  );
}
