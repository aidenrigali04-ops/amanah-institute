import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAcademyCourse } from "../api";
import "./AcademyCourseDetail.css";

interface Lesson {
  id: string;
  title: string;
  durationMinutes: number | null;
  completedAt: string | null;
}

interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

export default function AcademyCourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<{ id: string; title: string; description: string | null; modules: Module[]; completionPercent: number } | null>(null);

  useEffect(() => {
    if (!id) return;
    getAcademyCourse(id).then(setCourse).catch(() => setCourse(null));
  }, [id]);

  if (!course) return <div className="acd-page"><div className="acd-loading">Loading…</div></div>;

  const firstLesson = course.modules[0]?.lessons[0];
  const firstIncomplete = course.modules.flatMap((m) => m.lessons).find((l) => !l.completedAt);

  return (
    <div className="acd-page">
      <header className="acd-header">
        <button type="button" className="acd-back" onClick={() => navigate("/academy")}>← Back to courses</button>
        <h1>{course.title}</h1>
        {course.description && <p className="acd-desc">{course.description}</p>}
        <div className="acd-progress-bar"><div className="acd-progress-fill" style={{ width: `${course.completionPercent}%` }} /></div>
        <p className="acd-pct">{course.completionPercent}% complete</p>
        <button type="button" className="acd-btn" onClick={() => navigate(firstIncomplete ? `/academy/lessons/${firstIncomplete.id}` : firstLesson ? `/academy/lessons/${firstLesson.id}` : "#")}>
          {firstIncomplete ? "Resume course" : "Start course"}
        </button>
      </header>
      <section className="acd-modules">
        <h2>Modules</h2>
        {course.modules.map((mod) => (
          <div key={mod.id} className="acd-module">
            <h3>{mod.title}</h3>
            <ul>
              {mod.lessons.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => navigate(`/academy/lessons/${l.id}`)}>
                    {l.completedAt ? "✓ " : ""}{l.title}
                    {l.durationMinutes != null && ` · ${l.durationMinutes} min`}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
