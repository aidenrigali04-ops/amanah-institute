import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAcademyDashboard, setTheme, getProfile } from "../api";
import "./AcademyDashboard.css";

interface DashboardData {
  continueLearning: {
    course: string | null;
    module: string;
    lesson: string;
    progress: number;
    resumeUrl: string;
  } | null;
  pathwayProgress: {
    pathwayName: string;
    coursesCompleted: number;
    coursesTotal: number;
    pathPercent: number;
    nextMilestone: string;
  };
  recommendedNextCourse: { id: string; title: string; reason: string; startUrl: string } | null;
  workspaceTask: { label: string; lessonTitle: string; openWorkspaceUrl: string } | null;
  weeklyKnowledgeTest: { questionCount: number; estimatedMinutes: number; startUrl: string };
  communityDiscussions: { askUrl: string; joinUrl: string; previewTitle: string };
  toolUpdates: { items: { name: string; description: string | null; url: string | null }[] };
  stats: { overallProgressPercent: number; currentStreakDays: number; badgesEarned: number };
  learningPaths: { id: string; slug: string; title: string; description: string | null; completedLessons: number; totalLessons: number; lessons: { id: string; slug: string; title: string; progress: number; completedAt: string | null }[] }[];
  recentBadges: { slug: string; name: string; icon: string | null; earnedAt: string }[];
}

export default function AcademyDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [theme, setThemeState] = useState<"light" | "dark">("dark");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfile().then((p) => p.theme && setThemeState(p.theme as "light" | "dark"));
  }, []);

  useEffect(() => {
    getAcademyDashboard()
      .then(setData as (d: unknown) => void)
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
            <button type="button" onClick={() => navigate("/invest")}>Trade</button>
            <button type="button" onClick={() => { localStorage.removeItem("amanah_token"); navigate("/login"); }}>Log out</button>
          </nav>
        </header>
        <div className="academy-loading">Loading…</div>
      </div>
    );
  }

  const { continueLearning, pathwayProgress, recommendedNextCourse, workspaceTask, weeklyKnowledgeTest, communityDiscussions, toolUpdates, stats, learningPaths, recentBadges } = data;

  return (
    <div className={`academy-page academy-theme-${theme}`}>
      <header className="academy-header">
        <h1>Amanah Wealth Academy</h1>
        <div className="academy-header-actions">
          <button type="button" className="theme-toggle" onClick={handleThemeToggle} aria-label="Toggle theme">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <nav>
            <button type="button" onClick={() => navigate("/academy/courses")}>All Courses</button>
            <button type="button" onClick={() => navigate("/academy/progress")}>My Progress</button>
            <button type="button" onClick={() => navigate("/invest")}>Trade</button>
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

        {/* 1. Continue Learning (primary) */}
        {continueLearning && (
          <section className="academy-section continue-learning">
            <h2>Continue Learning</h2>
            <div className="continue-content">
              {continueLearning.course && <span className="continue-course">{continueLearning.course}</span>}
              <h3>{continueLearning.lesson}</h3>
              <p>{continueLearning.module}</p>
              <div className="continue-meta">
                <span>Progress: {continueLearning.progress}%</span>
              </div>
              <button type="button" className="btn-primary btn-resume" onClick={() => navigate(continueLearning.resumeUrl)}>
                Resume Lesson
              </button>
            </div>
          </section>
        )}

        {/* 2. Pathway Progress */}
        <section className="academy-section pathway-progress">
          <h2>Pathway Progress</h2>
          <p className="pathway-name">{pathwayProgress.pathwayName}</p>
          <div className="pathway-bar">
            <div className="pathway-bar-fill" style={{ width: `${pathwayProgress.pathPercent}%` }} />
          </div>
          <p className="pathway-meta">{pathwayProgress.coursesCompleted} / {pathwayProgress.coursesTotal} courses · Next: {pathwayProgress.nextMilestone}</p>
        </section>

        {/* 3. Recommended Next Course */}
        {recommendedNextCourse && (
          <section className="academy-section recommended-course">
            <h2>Recommended Next Course</h2>
            <h3>{recommendedNextCourse.title}</h3>
            <p>{recommendedNextCourse.reason}</p>
            <button type="button" className="btn-primary" onClick={() => navigate(recommendedNextCourse.startUrl)}>Start Course</button>
          </section>
        )}

        {/* 4. Workspace Task */}
        {workspaceTask && (
          <section className="academy-section workspace-task">
            <h2>Workspace Task</h2>
            <p className="task-label">{workspaceTask.label}</p>
            <p className="task-lesson">{workspaceTask.lessonTitle}</p>
            <button type="button" className="btn-secondary" onClick={() => navigate(workspaceTask.openWorkspaceUrl)}>Open Workspace Template</button>
          </section>
        )}

        {/* 5. Weekly Knowledge Test */}
        <section className="academy-section weekly-quiz">
          <h2>Weekly Knowledge Check</h2>
          <p>{weeklyKnowledgeTest.questionCount} Questions · ~{weeklyKnowledgeTest.estimatedMinutes} min</p>
          <button type="button" className="btn-secondary" onClick={() => navigate(weeklyKnowledgeTest.startUrl)}>Start Quiz</button>
        </section>

        {/* 6. Community Discussion */}
        <section className="academy-section community-discussions">
          <h2>Community Discussions</h2>
          <p>{communityDiscussions.previewTitle}</p>
          <div className="community-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate(communityDiscussions.joinUrl)}>Join Discussion</button>
            <button type="button" className="btn-secondary" onClick={() => navigate(communityDiscussions.askUrl)}>Ask Question</button>
          </div>
        </section>

        {/* 7. Tool Updates */}
        {toolUpdates.items.length > 0 && (
          <section className="academy-section tool-updates">
            <h2>New Tool Releases</h2>
            <ul className="tool-list">
              {toolUpdates.items.map((t) => (
                <li key={t.name}>
                  <strong>{t.name}</strong>
                  {t.description && <span> — {t.description}</span>}
                  {t.url && <a href={t.url} target="_blank" rel="noopener noreferrer">Learn more</a>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Module cards (learning paths) — compact */}
        <section className="academy-section learning-paths">
          <h2>Modules</h2>
          <div className="paths-grid">
            {learningPaths.map((path) => (
              <div key={path.id} className="path-card">
                <h3>{path.title}</h3>
                <div className="path-progress">
                  <div className="path-progress-bar"><div className="path-progress-fill" style={{ width: path.totalLessons ? `${(path.completedLessons / path.totalLessons) * 100}%` : "0%" }} /></div>
                  <span>{path.completedLessons} / {path.totalLessons} lessons</span>
                </div>
                {path.lessons?.length > 0 && (
                  <ul className="path-lessons">
                    {path.lessons.slice(0, 4).map((l) => (
                      <li key={l.id}>
                        <button type="button" className="lesson-link" onClick={() => navigate(`/academy/lessons/${l.id}`)}>
                          {l.completedAt ? "✓ " : ""}{l.title}
                        </button>
                      </li>
                    ))}
                    {path.lessons.length > 4 && <li className="lesson-more"><button type="button" className="lesson-link" onClick={() => navigate("/academy/courses")}>View all</button></li>}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>

        {recentBadges.length > 0 && (
          <section className="academy-section recent-badges">
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
