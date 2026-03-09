import { useEffect, useState } from "react";
import { getDashboard, getWorkspaceProjects } from "../api";
import { useProfile } from "../hooks/useProfile";
import "./HomeOverview.css";

export default function HomeOverview() {
  const { displayName, email } = useProfile();
  const [dashboard, setDashboard] = useState<{
    netWorthSnapshot?: { totalCents: number };
    nextRecommendedAction?: { label: string; lessonId?: string; path?: string };
  } | null>(null);
  const [projectCount, setProjectCount] = useState<number | null>(null);

  useEffect(() => {
    getDashboard().then(setDashboard).catch(() => setDashboard(null));
    getWorkspaceProjects().then((r) => setProjectCount(r.projects?.length ?? 0)).catch(() => setProjectCount(null));
  }, []);

  const totalProjects = projectCount ?? 24;
  const endedProjects = Math.floor(totalProjects * 0.42);
  const runningProjects = Math.floor(totalProjects * 0.5);
  const pendingProjects = Math.max(0, totalProjects - endedProjects - runningProjects);
  const nextAction = dashboard?.nextRecommendedAction?.label ?? "Continue Lesson";

  return (
    <div className="ho-page">
      <header className="ho-header">
        <div className="ho-search-wrap">
          <span className="ho-search-icon">⌕</span>
          <input type="text" className="ho-search" placeholder="Search task" />
          <span className="ho-kbd">⌘ F</span>
        </div>
        <div className="ho-user">
          <button type="button" className="ho-icon">✉</button>
          <button type="button" className="ho-icon">🔔</button>
          <div className="ho-avatar">👤</div>
          <div>
            <div className="ho-name">{displayName}</div>
            <div className="ho-email">{email ?? ""}</div>
          </div>
        </div>
      </header>

      <aside className="ho-sidebar">
        <div className="ho-logo">● Amanah Institute</div>
        <nav className="ho-nav">
          <a href="/home" className="ho-nav-item ho-nav-item--active">▦ Dashboard</a>
          <a href="/academy" className="ho-nav-item">☑ Academy <span className="ho-badge">12+</span></a>
          <a href="#calendar" className="ho-nav-item">📅 Calendar</a>
          <a href="/dashboard" className="ho-nav-item">▤ Investing</a>
          <a href="#team" className="ho-nav-item">👥 Team</a>
        </nav>
        <div className="ho-nav ho-nav--bottom">
          <a href="#settings" className="ho-nav-item">⚙ Settings</a>
          <a href="#help" className="ho-nav-item">? Help</a>
          <a href="#logout" className="ho-nav-item">⎋ Logout</a>
        </div>
        <div className="ho-download-card">
          <p className="ho-download-title">Download our Mobile App</p>
          <p className="ho-download-sub">Wealth & learning on the go</p>
          <button type="button" className="ho-download-btn">Download</button>
        </div>
      </aside>

      <main className="ho-main">
        <div className="ho-title-wrap">
          <div>
            <h1>Dashboard</h1>
            <p>Your wealth command center. Track projects, academy progress, and next actions.</p>
          </div>
          <div className="ho-actions">
            <button type="button" className="ho-btn ho-btn--primary">+ Add Project</button>
            <button type="button" className="ho-btn ho-btn--outline">Import Data</button>
          </div>
        </div>

        <div className="ho-stats">
          <div className="ho-stat-card ho-stat-card--green">
            <span className="ho-stat-value">{totalProjects}</span>
            <span className="ho-stat-label">Total Projects</span>
            <span className="ho-stat-trend">Workspace & academy</span>
          </div>
          <div className="ho-stat-card">
            <span className="ho-stat-value">{endedProjects}</span>
            <span className="ho-stat-label">Ended Projects</span>
            <span className="ho-stat-trend">Completed</span>
          </div>
          <div className="ho-stat-card">
            <span className="ho-stat-value">{runningProjects}</span>
            <span className="ho-stat-label">Running Projects</span>
            <span className="ho-stat-trend">In progress</span>
          </div>
          <div className="ho-stat-card">
            <span className="ho-stat-value">{pendingProjects}</span>
            <span className="ho-stat-label">Pending Project</span>
            <span className="ho-stat-trend">On discuss</span>
          </div>
        </div>

        <div className="ho-grid">
          <div className="ho-card ho-card-analytics">
            <h2>Project Analytics</h2>
            <div className="ho-bar-chart">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={d + i} className={`ho-bar ${i >= 1 && i <= 3 ? "ho-bar--fill" : ""}`} style={i === 2 ? { height: "74%" } : {}} />
              ))}
            </div>
          </div>
          <div className="ho-card">
            <h2>Next action</h2>
            <p className="ho-reminder-title">{nextAction}</p>
            <p className="ho-reminder-time">Recommended from your progress</p>
            <a href="/academy" className="ho-btn ho-btn--primary ho-btn--sm" style={{ display: "inline-block", textDecoration: "none", color: "inherit" }}>Go to Academy</a>
          </div>
          <div className="ho-card">
            <h2>Project <button type="button" className="ho-link-btn">+ New</button></h2>
            <ul className="ho-project-list">
              {["Develop API Endpoints", "Onboarding Flow", "Build Dashboard", "Optimize Page Load", "Cross-Browser Testing"].map((name, i) => (
                <li key={i}><span className="ho-project-dot" /> {name} <span className="ho-due">Nov {26 + i}, 2024</span></li>
              ))}
            </ul>
          </div>
          <div className="ho-card ho-card-team">
            <h2>Team Collaboration <button type="button" className="ho-link-btn">+ Add Member</button></h2>
            <ul className="ho-team-list">
              <li><div className="ho-team-avatar" /> Alexandra Deff — Working on Github Project Repository <span className="ho-tag ho-tag--green">Completed</span></li>
              <li><div className="ho-team-avatar" /> Edwin Adenike — Integrate User Authentication System <span className="ho-tag ho-tag--yellow">In Progress</span></li>
              <li><div className="ho-team-avatar" /> Isaac Oluwatemilorun — Develop Search and Filter Functionality <span className="ho-tag ho-tag--red">Pending</span></li>
              <li><div className="ho-team-avatar" /> David Oshodi — Responsive Layout for Homepage <span className="ho-tag ho-tag--yellow">In Progress</span></li>
            </ul>
          </div>
          <div className="ho-card">
            <h2>Project Progress</h2>
            <div className="ho-donut-wrap"><div className="ho-donut" /><span className="ho-donut-label">41% Project Ended</span></div>
            <div className="ho-legend"><span className="ho-legend-dot ho-legend-dot--green" /> Completed <span className="ho-legend-dot ho-legend-dot--dark" /> In Progress <span className="ho-legend-dot ho-legend-dot--striped" /> Pending</div>
          </div>
          <div className="ho-card ho-card-time">
            <h2>Time Tracker</h2>
            <p className="ho-time-value">01:24:08</p>
            <button type="button" className="ho-time-btn">⏸</button>
            <button type="button" className="ho-time-btn ho-time-btn--stop">⏹</button>
          </div>
        </div>
      </main>
    </div>
  );
}
