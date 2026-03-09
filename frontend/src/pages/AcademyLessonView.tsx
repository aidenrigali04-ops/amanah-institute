import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAcademyLesson, getLessonPrevNext, saveLessonProgress } from "../api";
import "./AcademyLessonView.css";

export default function AcademyLessonView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<{
    id: string;
    title: string;
    content: string | null;
    keyTakeaways: string | null;
    durationMinutes: number | null;
    module: { title: string; slug: string };
    progress: number;
    completedAt: string | null;
  } | null>(null);
  const [prevNext, setPrevNext] = useState<{ prev: { id: string; title: string } | null; next: { id: string; title: string } | null }>({ prev: null, next: null });

  useEffect(() => {
    if (!id) return;
    getAcademyLesson(id).then(setLesson).catch(() => setLesson(null));
    getLessonPrevNext(id).then(setPrevNext).catch(() => setPrevNext({ prev: null, next: null }));
  }, [id]);

  const handleComplete = () => {
    if (!id) return;
    saveLessonProgress(id, { progressPercent: 100, completed: true }).then(() => {
      setLesson((l) => (l ? { ...l, progress: 100, completedAt: new Date().toISOString() } : null));
    }).catch(console.error);
  };

  if (!lesson) return <div className="alv-page"><div className="alv-loading">Loading…</div></div>;

  let takeaways: string[] = [];
  try {
    const raw = lesson.keyTakeaways;
    if (Array.isArray(raw)) takeaways = raw;
    else if (typeof raw === "string") takeaways = JSON.parse(raw || "[]");
  } catch {
    takeaways = [];
  }

  return (
    <div className="alv-page">
      <header className="alv-header">
        <button type="button" className="alv-back" onClick={() => navigate("/academy")}>← Academy</button>
        <span className="alv-module">{lesson.module?.title}</span>
      </header>
      <article className="alv-article">
        <h1>{lesson.title}</h1>
        {lesson.durationMinutes != null && <p className="alv-meta">Duration: {lesson.durationMinutes} min</p>}
        <div className="alv-progress-bar"><div className="alv-progress-fill" style={{ width: `${lesson.progress}%` }} /></div>
        <div className="alv-content">
          {lesson.content ? <div dangerouslySetInnerHTML={{ __html: lesson.content }} /> : <p>No content for this lesson yet.</p>}
        </div>
        {Array.isArray(takeaways) && takeaways.length > 0 && (
          <section className="alv-takeaways">
            <h2>Key takeaways</h2>
            <ul>{takeaways.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul>
          </section>
        )}
      </article>
      <footer className="alv-footer">
        <div className="alv-nav">
          {prevNext.prev ? <button type="button" onClick={() => navigate(`/academy/lessons/${prevNext.prev!.id}`)}>← {prevNext.prev.title}</button> : <span />}
          {prevNext.next ? <button type="button" onClick={() => navigate(`/academy/lessons/${prevNext.next!.id}`)}>{prevNext.next.title} →</button> : <span />}
        </div>
        <button type="button" className="alv-complete" onClick={handleComplete} disabled={!!lesson.completedAt}>
          {lesson.completedAt ? "Completed ✓" : "Mark complete"}
        </button>
      </footer>
    </div>
  );
}
