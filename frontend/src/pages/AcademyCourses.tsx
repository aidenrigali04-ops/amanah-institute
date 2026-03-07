import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAcademyCourses } from "../api";
import "./AcademyCourses.css";

interface Course {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  pathwayName: string;
  pathwaySlug: string;
  moduleCount: number;
  estimatedMinutes: number | null;
  skillLevel: string | null;
  completionPercent: number;
}

export default function AcademyCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [pathways, setPathways] = useState<{ id: string; slug: string; name: string; description: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAcademyCourses()
      .then((res: { courses: Course[]; pathways: { id: string; slug: string; name: string; description: string | null }[] }) => {
        setCourses(res.courses);
        setPathways(res.pathways || []);
      })
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="academy-courses-page">
        <header className="academy-courses-header">
          <button type="button" className="back-link" onClick={() => navigate("/academy")}>← Academy</button>
          <h1>Courses</h1>
        </header>
        <div className="academy-courses-loading">Loading courses…</div>
      </div>
    );
  }

  return (
    <div className="academy-courses-page">
      <header className="academy-courses-header">
        <button type="button" className="back-link" onClick={() => navigate("/academy")}>← Academy</button>
        <h1>Courses</h1>
      </header>
      <main className="academy-courses-main">
        {pathways.length > 0 && (
          <p className="pathway-info">Pathway: {pathways.map((p) => p.name).join(", ")}</p>
        )}
        {courses.length === 0 ? (
          <p className="no-courses">No courses yet. Check back soon.</p>
        ) : (
          <div className="courses-grid">
            {courses.map((c) => (
              <article key={c.id} className="course-card" onClick={() => navigate(`/academy/course/${c.id}`)}>
                <div className="course-card-header">
                  <span className="course-pathway">{c.pathwayName}</span>
                  <span className="course-progress">{c.completionPercent}%</span>
                </div>
                <h2>{c.title}</h2>
                {c.description && <p>{c.description}</p>}
                <div className="course-meta">
                  {c.moduleCount} modules
                  {c.estimatedMinutes != null && ` · ~${c.estimatedMinutes} min`}
                  {c.skillLevel && ` · ${c.skillLevel}`}
                </div>
                <button type="button" className="course-btn" onClick={(e) => { e.stopPropagation(); navigate(`/academy/course/${c.id}`); }}>
                  {c.completionPercent > 0 ? "Resume" : "Start"} Course
                </button>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
