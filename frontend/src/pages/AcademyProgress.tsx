import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAcademyProgress } from "../api";
import "./AcademyProgress.css";

interface CourseProgressItem {
  courseId: string;
  title: string;
  slug: string;
  completionPercent: number;
}

export default function AcademyProgress() {
  const navigate = useNavigate();
  const [data, setData] = useState<{
    overallPercent: number;
    completedLessons: number;
    totalLessons: number;
    courseProgress: CourseProgressItem[];
    pathways: { id: string; slug: string; name: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAcademyProgress()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="academy-progress-page">
        <header className="academy-progress-header">
          <button type="button" className="back-link" onClick={() => navigate("/academy")}>← Academy</button>
          <h1>My Progress</h1>
        </header>
        <div className="academy-progress-loading">Loading…</div>
      </div>
    );
  }

  return (
    <div className="academy-progress-page">
      <header className="academy-progress-header">
        <button type="button" className="back-link" onClick={() => navigate("/academy")}>← Academy</button>
        <h1>My Progress</h1>
      </header>
      <main className="academy-progress-main">
        <section className="progress-overview">
          <h2>Overall</h2>
          <div className="overall-percent">{data.overallPercent}%</div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${data.overallPercent}%` }} />
          </div>
          <p>{data.completedLessons} of {data.totalLessons} lessons completed</p>
        </section>

        <section className="course-progress-list">
          <h2>By Course</h2>
          {data.courseProgress.length === 0 ? (
            <p className="no-courses">No course progress yet. Start a course from the Academy.</p>
          ) : (
            <ul className="course-progress-items">
              {data.courseProgress.map((c) => (
                <li key={c.courseId}>
                  <button type="button" className="course-progress-row" onClick={() => navigate(`/academy/course/${c.courseId}`)}>
                    <span className="course-title">{c.title}</span>
                    <span className="course-percent">{c.completionPercent}%</span>
                  </button>
                  <div className="course-progress-bar">
                    <div className="course-progress-bar-fill" style={{ width: `${c.completionPercent}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
