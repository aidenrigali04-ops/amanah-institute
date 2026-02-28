import { useState, useRef, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import "./DashboardLayout.css";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationDismissed, setNotificationDismissed] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) setNotificationOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("amanah_token");
    navigate("/login", { replace: true });
  };

  return (
    <div className="dashboard-app">
      <aside className="dashboard-sidebar">
        <NavLink to="/dashboard" className="sidebar-logo">
          <img src="/amanah-logo.png" alt="Amanah" width={120} height={48} />
        </NavLink>
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "sidebar-item active" : "sidebar-item")}>
            Home
          </NavLink>
          <span className="sidebar-heading">Academy</span>
          <NavLink to="/academy" className={({ isActive }) => (isActive ? "sidebar-item active" : "sidebar-item")}>
            Continue Journey
          </NavLink>
          <NavLink to="/academy/courses" className={({ isActive }) => (isActive ? "sidebar-item active" : "sidebar-item")}>
            All Courses
          </NavLink>
          <NavLink to="/workspace" className={({ isActive }) => (isActive ? "sidebar-item active" : "sidebar-item")}>
            Workspace
          </NavLink>
          <span className="sidebar-heading">Tradings</span>
          <NavLink to="/invest" className={({ isActive }) => (isActive ? "sidebar-item active" : "sidebar-item")}>
            My Account
          </NavLink>
          <NavLink to="/invest/automated" className={({ isActive }) => (isActive ? "sidebar-item active" : "sidebar-item")}>
            Automated Account
          </NavLink>
          <NavLink to="/invest/screener" className={({ isActive }) => (isActive ? "sidebar-item active" : "sidebar-item")}>
            Stocks Screener
          </NavLink>
          <NavLink to="/invest/analytics" className={({ isActive }) => (isActive ? "sidebar-item active" : "sidebar-item")}>
            Analytics
          </NavLink>
          <span className="sidebar-heading">Community</span>
          <NavLink to="/community" className={({ isActive }) => (isActive ? "sidebar-item active" : "sidebar-item")}>
            Chat
          </NavLink>
          <NavLink to="/zakat" className={({ isActive }) => (isActive ? "sidebar-item active" : "sidebar-item")}>
            Zakat
          </NavLink>
        </nav>
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-search">
            <span className="header-search-icon" aria-hidden>⌕</span>
            <input type="search" placeholder="Search..." className="header-search-input" aria-label="Search" />
          </div>
          <div className="header-actions">
            <div className="header-dropdown" ref={dropdownRef}>
              <button
                type="button"
                className="header-icon-btn"
                onClick={() => setNotificationOpen((o) => !o)}
                aria-label="Notifications"
                aria-expanded={notificationOpen}
              >
                <span className="header-icon" aria-hidden>✈</span>
              </button>
              {notificationOpen && (
                <div className="notification-dropdown">
                  {!notificationDismissed && (
                    <div className="notification-item notification-item-highlight">
                      <p>Personalize your academy dashboard for the best experience.</p>
                      <button
                        type="button"
                        className="notification-cta"
                        onClick={() => {
                          setNotificationOpen(false);
                          navigate("/academy");
                        }}
                      >
                        Personalize Academy
                      </button>
                      <button
                        type="button"
                        className="notification-dismiss"
                        onClick={() => setNotificationDismissed(true)}
                        aria-label="Dismiss"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  {notificationDismissed && (
                    <p className="notification-empty">No new notifications.</p>
                  )}
                </div>
              )}
            </div>
            <NavLink to="/profile" className="header-icon-btn" aria-label="Settings">
              <span className="header-icon" aria-hidden>⚙</span>
            </NavLink>
            <div className="header-dropdown" ref={profileRef}>
              <button
                type="button"
                className="header-icon-btn"
                aria-label="Profile"
                onClick={() => setProfileOpen((o) => !o)}
                aria-expanded={profileOpen}
              >
                <span className="header-icon header-icon-user" aria-hidden>👤</span>
              </button>
              {profileOpen && (
                <div className="profile-menu">
                  <NavLink to="/profile" onClick={() => setProfileOpen(false)}>Profile</NavLink>
                  <button type="button" onClick={() => { setProfileOpen(false); handleLogout(); }}>Log out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
