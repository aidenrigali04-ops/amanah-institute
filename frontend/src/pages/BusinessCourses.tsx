import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAcademyDashboard, getAcademyCourses, getProfile } from "../api";
import "./BusinessCourses.css";

interface Course {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  pathwayName: string;
  moduleCount: number;
  estimatedMinutes: number | null;
  completionPercent: number;
}

/** Fallback courses when API returns empty – matches Amanah curriculum */
const FALLBACK_FEATURED: Course[] = [
  { id: "fb-1", slug: "entrepreneurship-foundations", title: "Entrepreneurship Foundations", description: null, pathwayName: "Entrepreneurship", moduleCount: 5, estimatedMinutes: 120, completionPercent: 0 },
  { id: "fb-2", slug: "branding-positioning", title: "Branding & Positioning", description: null, pathwayName: "Entrepreneurship", moduleCount: 5, estimatedMinutes: 90, completionPercent: 0 },
  { id: "fb-3", slug: "marketing-systems", title: "Marketing Systems", description: null, pathwayName: "Entrepreneurship", moduleCount: 6, estimatedMinutes: 150, completionPercent: 0 },
];

const FALLBACK_RECOMMENDED: Course[] = [
  { id: "fb-r1", slug: "entrepreneurship-foundations", title: "Entrepreneurship Foundations", description: null, pathwayName: "Entrepreneurship", moduleCount: 5, estimatedMinutes: 120, completionPercent: 0 },
  { id: "fb-r2", slug: "customer-market-research", title: "Customer & Market Research", description: null, pathwayName: "Entrepreneurship", moduleCount: 5, estimatedMinutes: 100, completionPercent: 0 },
  { id: "fb-r3", slug: "branding-positioning", title: "Branding & Positioning", description: null, pathwayName: "Entrepreneurship", moduleCount: 5, estimatedMinutes: 90, completionPercent: 0 },
  { id: "fb-r4", slug: "marketing-systems", title: "Marketing Systems", description: null, pathwayName: "Entrepreneurship", moduleCount: 6, estimatedMinutes: 150, completionPercent: 0 },
  { id: "fb-r5", slug: "halal-investing", title: "Halal Investing Principles", description: null, pathwayName: "Trading & Investing", moduleCount: 4, estimatedMinutes: 80, completionPercent: 0 },
];

export default function BusinessCourses() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [dashboard, setDashboard] = useState<{
    continueLearning: { lesson: string; module: string; resumeUrl: string } | null;
    stats: { overallProgressPercent: number; currentStreakDays: number };
    pathwayProgress: { pathPercent: number; coursesTotal: number; coursesCompleted: number };
  } | null>(null);
  const [user, setUser] = useState<{ firstName?: string; lastName?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAcademyCourses(), getAcademyDashboard(), getProfile().catch(() => null)])
      .then(([coursesRes, dash, profile]) => {
        const list = (coursesRes as { courses?: Course[] })?.courses ?? [];
        setCourses(list.length > 0 ? list : [...FALLBACK_FEATURED, ...FALLBACK_RECOMMENDED]);
        setDashboard(dash);
        setUser(profile || null);
      })
      .catch(() => {
        setCourses([...FALLBACK_FEATURED, ...FALLBACK_RECOMMENDED]);
      })
      .finally(() => setLoading(false));
  }, []);

  const featured = courses.length >= 3 ? courses.slice(0, 3) : FALLBACK_FEATURED;
  const recommended = courses.length >= 5 ? courses.slice(0, 5) : FALLBACK_RECOMMENDED;
  const filteredRecommended = search.trim()
    ? recommended.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    : recommended;

  const totalLessons = dashboard?.pathwayProgress?.coursesTotal
    ? dashboard.pathwayProgress.coursesTotal * 6
    : 24;
  const studyHours = Math.round((dashboard?.stats?.overallProgressPercent ?? 0) * (totalLessons * 0.5) / 100) || 0;

  const scheduleItems = dashboard?.continueLearning
    ? [{ date: "Today", title: dashboard.continueLearning.lesson, progress: "1/1", active: true }]
    : [];

  const currentDate = new Date();
  const monthName = currentDate.toLocaleString("en-US", { month: "long" });
  const year = currentDate.getFullYear();
  const daysInMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(year, currentDate.getMonth(), 1).getDay();
  const dayList = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const padStart = firstDay === 0 ? 6 : firstDay - 1;

  if (loading) {
    return (
      <div className="business-courses-page">
        <div className="bc-loading">Loading…</div>
      </div>
    );
  }

  return (
    <div className="business-courses-page">
      <main className="bc-main">
        <header className="bc-header">
          <div className="bc-search-wrap">
            <span className="bc-search-icon" aria-hidden>⌕</span>
            <input
              type="search"
              className="bc-search"
              placeholder="Search your favorite course"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="bc-header-icons">
            <button type="button" className="bc-icon-btn" aria-label="Messages">💬</button>
            <button type="button" className="bc-icon-btn" aria-label="Notifications">🔔</button>
            <button type="button" className="bc-icon-btn bc-avatar" aria-label="Profile">👤</button>
          </div>
        </header>

        <section className="bc-featured">
          <h2 className="bc-section-title">Featured Course</h2>
          <div className="bc-featured-nav">
            <button type="button" className="bc-carousel-btn" aria-label="Previous">‹</button>
            <button type="button" className="bc-carousel-btn" aria-label="Next">›</button>
          </div>
          <div className="bc-featured-cards">
            {featured.map((course, i) => (
              <div
                key={course.id}
                className={`bc-featured-card ${i === 0 ? "bc-featured-card--highlight" : ""}`}
                onClick={() => navigate(`/academy/course/${course.id}`)}
              >
                <div className="bc-featured-icon">{i === 0 ? "▣" : "⚙"}</div>
                <h3>{course.title}</h3>
                <p className="bc-featured-meta">
                  {course.moduleCount} Modules · {course.estimatedMinutes ? `${Math.round(course.estimatedMinutes / 60)}h` : "—"} total
                </p>
                <button type="button" className="bc-btn bc-btn-white" onClick={(e) => { e.stopPropagation(); navigate(`/academy/course/${course.id}`); }}>
                  {course.completionPercent > 0 ? "Continue" : "Start"} Course
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="bc-recommended">
          <h2 className="bc-section-title">Recommended Course</h2>
          <button type="button" className="bc-see-all" onClick={() => navigate("/academy/courses")}>SEE ALL</button>
          <ul className="bc-recommended-list">
            {filteredRecommended.map((course, i) => (
              <li
                key={course.id}
                className={`bc-recommended-item ${i === 0 ? "bc-recommended-item--highlight" : ""}`}
                onClick={() => navigate(`/academy/course/${course.id}`)}
              >
                <div className="bc-rec-thumb" />
                <div className="bc-rec-body">
                  <span className="bc-rec-cat">{course.pathwayName.toUpperCase()}</span>
                  <h4>{course.title}</h4>
                  <div className="bc-rec-meta">
                    <span>📅 {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                    <span>⭐ 5.0</span>
                  </div>
                </div>
                <span className="bc-rec-arrow">→</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <aside className="bc-sidebar">
        <div className="bc-profile">
          <div className="bc-profile-avatar">👤</div>
          <h3 className="bc-profile-name">
            {user?.firstName || user?.lastName ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "Student"}
            <span className="bc-verified">✓</span>
          </h3>
          <p className="bc-profile-status">Amanah Institute · Verified Student</p>
          <div className="bc-profile-stats">
            <div className="bc-stat"><strong>{courses.length}</strong><span>Total Course</span></div>
            <div className="bc-stat"><strong>{studyHours}</strong><span>Study Hours</span></div>
            <div className="bc-stat"><strong>5.0</strong><span>⭐ Rating</span></div>
          </div>
        </div>

        <div className="bc-calendar">
          <div className="bc-calendar-header">
            <button type="button" className="bc-cal-nav">‹</button>
            <span>{monthName} {year}</span>
            <button type="button" className="bc-cal-nav">›</button>
          </div>
          <div className="bc-cal-days">M T W T F S S</div>
          <div className="bc-cal-grid">
            {Array(padStart).fill(null).map((_, i) => <span key={`pad-${i}`} className="bc-cal-day bc-cal-day--muted" />)}
            {dayList.map((d) => (
              <span key={d} className={`bc-cal-day ${d === currentDate.getDate() ? "bc-cal-day--today" : ""}`}>{d}</span>
            ))}
          </div>
        </div>

        <div className="bc-schedule">
          <h3>Schedule class</h3>
          {scheduleItems.length > 0 ? (
            <ul className="bc-schedule-list">
              {scheduleItems.map((item, i) => (
                <li key={i} className={`bc-schedule-item ${item.active ? "bc-schedule-item--active" : ""}`} onClick={() => dashboard?.continueLearning && navigate(dashboard.continueLearning.resumeUrl)}>
                  <span className="bc-schedule-date">{item.date}</span>
                  <span className="bc-schedule-title">{item.title}</span>
                  <span className="bc-schedule-progress">✓ {item.progress}</span>
                  <span className="bc-schedule-arrow">→</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="bc-schedule-empty">No upcoming class. Start a course from Featured or Recommended.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
