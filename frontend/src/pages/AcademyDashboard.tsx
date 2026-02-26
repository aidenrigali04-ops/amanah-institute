import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAcademyDashboard, setTheme, getProfile } from "../api";
import "./AcademyDashboard.css";

export default function AcademyDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<{
    stats: { overallProgressPercent: number; currentStreakDays: number; badgesEarned: number };
    continueLesson: { id: string; title: string; description: string | null; durationMinutes: number | null; module: { slug: string; title: string }; progress: number } | null;
    learningPaths: { id: string; slug: string; title: string; description: string | null; completedLessons: number; totalLessons: number; lessons: { id: string; slug: string; title: string; progress: number; completedAt: string | null }[] }[];
    recentBadges: { slug: string; name: string; icon: string | null; earnedAt: string }[];
  } | null>(null);
  const [theme, setThemeState] = useState<"light" | "dark">("dark");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfile().then((p) => p.theme && setThemeState(p.theme as "light" | "dark"));
  }, []);

  useEffect(() => {
    getAcademyDashboard()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const handleThemeToggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setThemeState(next);
    setTheme(next).catch(() => {});
  };

  if (loading || !data) {
    return (
      <div className="academy-page">
        <header className="academy-header">
          <h1>Amanah Wealth Academy</h1>
          <nav>
            <button type="button" onClick={() => navigate("/trade")}>Trade</button>
            <button type="button" onClick={() => { localStorage.removeItem("amanah_token"); navigate("/login"); }}>Log out</button>
          </nav>
        </header>
        <div className="academy-loading">Loading…</div>
      </div>
    );
  }

  const { stats, continueLesson, learningPaths, recentBadges } = data;

  return (
    <div className={`academy-page academy-theme-${theme}`}>
      <header className="academy-header">
        <h1>Amanah Wealth Academy</h1>
        <div className="academy-header-actions">
          <button type="button" className="theme-toggle" onClick={handleThemeToggle} aria-label="Toggle theme">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <nav>
            <button type="button" onClick={() => navigate("/trade")}>Trade</button>
            <button type="button" onClick={() => { localStorage.removeItem("amanah_token"); navigate("/login"); }}>Log out</button>
          </nav>
        </div>
      </header>

      <main className="academy-dashboard">
        <section className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.overallProgressPercent}%</div>
            <div className="stat-label">Overall Progress</div>
            <div className="stat-bar"><div className="stat-bar-fill" style={{ width: `${stats.overallProgressPercent}%` }} /></div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.currentStreakDays}</div>
            <div className="stat-label">Day Streak</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.badgesEarned}</div>
            <div className="stat-label">Badges Earned</div>
          </div>
        </section>

        {continueLesson && (
          <section className="continue-card">
            <h2>Continue Learning</h2>
            <div className="continue-content">
              <h3>{continueLesson.title}</h3>
              <p>{continueLesson.description || continueLesson.module?.title}</p>
              <div className="continue-meta">
                {continueLesson.durationMinutes && <span>~{continueLesson.durationMinutes} min</span>}
                <span>{continueLesson.module?.title}</span>
              </div>
              <button type="button" className="btn-continue" onClick={() => navigate(`/academy/lessons/${continueLesson.id}`)}>
                Continue
              </button>
            </div>
          </section>
        )}

        <section className="learning-paths">
          <h2>Learning Paths</h2>
          <div className="paths-grid">
            {learningPaths.map((path) => (
              <div key={path.id} className="path-card">
                <div className="path-icon">📚</div>
                <h3>{path.title}</h3>
                <p>{path.description || ""}</p>
                <div className="path-progress">
                  <div className="path-progress-bar"><div className="path-progress-fill" style={{ width: path.totalLessons ? `${(path.completedLessons / path.totalLessons) * 100}%` : "0%" }} /></div>
                  <span>{path.completedLessons} / {path.totalLessons} lessons</span>
                </div>
                {path.lessons?.length > 0 && (
                  <ul className="path-lessons">
                    {path.lessons.map((l) => (
                      <li key={l.id}>
                        <button type="button" className="lesson-link" onClick={() => navigate(`/academy/lessons/${l.id}`)}>
                          {l.completedAt ? "✓ " : ""}{l.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>

        {recentBadges.length > 0 && (
          <section className="recent-badges">
            <h2>Recent Achievements</h2>
            <div className="badges-list">
              {recentBadges.map((b) => (
                <div key={b.slug} className="badge-item">
                  <span className="badge-icon">{b.icon || "🏅"}</span>
                  <span className="badge-name">{b.name}</span>
                  <span className="badge-date">{new Date(b.earnedAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
