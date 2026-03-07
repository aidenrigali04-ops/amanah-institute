import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAcademyCourse } from "../api";
import "./AcademyCourseDetail.css";

interface Lesson {
  id: string;
  slug: string;
  title: string;
  durationMinutes: number | null;
  orderIndex: number;
  progress: number;
  completedAt: string | null;
}

interface Module {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  lessons: Lesson[];
  completedLessons: number;
  totalLessons: number;
}

interface CourseData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  estimatedMinutes: number | null;
  skillLevel: string | null;
  pathway: { id: string; slug: string; name: string };
  modules: Module[];
  completionPercent: number;
  lastLessonId: string | null;
}

export default function AcademyCourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getAcademyCourse(id).then(setCourse).catch(() => setCourse(null)).finally(() => setLoading(false));
  }, [id]);

  if (loading || !course) {
    return (
      <div className="academy-course-detail-page">
        <header className="academy-course-detail-header">
          <button type="button" className="back-link" onClick={() => navigate("/academy/courses")}>← Courses</button>
          <h1>Course</h1>
        </header>
        <div className="academy-course-detail-loading">Loading…</div>
      </div>
    );
  }

  let firstIncompleteLesson: Lesson | null = null;
  for (const m of course.modules) {
    const next = m.lessons.find((l) => !l.completedAt);
    if (next) {
      firstIncompleteLesson = next;
      break;
    }
  }
  const firstLesson = course.modules[0]?.lessons[0];

  return (
    <div className="academy-course-detail-page">
      <header className="academy-course-detail-header">
        <button type="button" className="back-link" onClick={() => navigate("/academy/courses")}>← Courses</button>
        <h1>{course.title}</h1>
      </header>
      <main className="academy-course-detail-main">
        <section className="course-overview">
          {course.description && <p className="course-description">{course.description}</p>}
          <div className="course-meta">
            <span>{course.pathway.name}</span>
            {course.estimatedMinutes != null && <span>~{course.estimatedMinutes} min</span>}
            {course.skillLevel && <span>{course.skillLevel}</span>}
          </div>
          <div className="course-progress-bar">
            <div className="course-progress-fill" style={{ width: `${course.completionPercent}%` }} />
          </div>
          <p className="course-progress-label">{course.completionPercent}% complete</p>
          <div className="course-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate(firstIncompleteLesson ? `/academy/lessons/${firstIncompleteLesson.id}` : firstLesson ? `/academy/lessons/${firstLesson.id}` : "/academy/courses")}
            >
              {firstIncompleteLesson ? "Resume Course" : firstLesson ? "Start Course" : "View modules"}
            </button>
          </div>
        </section>
        <section className="course-modules">
          <h2>Modules</h2>
          {course.modules.map((mod) => (
            <div key={mod.id} className="module-block">
              <h3>{mod.title}</h3>
              {mod.description && <p>{mod.description}</p>}
              <p className="module-progress">{mod.completedLessons} / {mod.totalLessons} lessons</p>
              <ul className="lesson-list">
                {mod.lessons.map((l) => (
                  <li key={l.id}>
                    <button type="button" className={"lesson-row " + (l.completedAt ? "completed" : "")} onClick={() => navigate(`/academy/lessons/${l.id}`)}>
                      {l.completedAt ? "✓ " : ""}{l.title}
                      {l.durationMinutes != null && <span className="lesson-duration">~{l.durationMinutes} min</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
