import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { getAcademyLesson, saveLessonProgress, saveActionResponses, getLessonPrevNext } from "../api";
import "./LessonViewer.css";

interface ActionField {
  key: string;
  label: string;
  type: string;
  placeholder?: string;
}

export default function LessonViewer() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<{
    id: string;
    title: string;
    content: string | null;
    durationMinutes: number | null;
    actionAssignmentSchema: ActionField[] | null;
    actionResponses: Record<string, string>;
    progress: number;
    completedAt: string | null;
    module: { slug: string; title: string };
  } | null>(null);
  const [prevNext, setPrevNext] = useState<{ prev: { id: string; title: string } | null; next: { id: string; title: string } | null }>({ prev: null, next: null });
  const [actionValues, setActionValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!lessonId) return;
    getAcademyLesson(lessonId).then((l) => {
      setLesson(l);
      setActionValues(l.actionResponses || {});
      setCompleted(!!l.completedAt);
    });
    getLessonPrevNext(lessonId).then(setPrevNext);
  }, [lessonId]);

  const handleSaveField = async (key: string, value: string) => {
    if (!lessonId) return;
    setSaving(key);
    try {
      await saveActionResponses(lessonId, { ...actionValues, [key]: value });
      setActionValues((prev) => ({ ...prev, [key]: value }));
    } finally {
      setSaving(null);
    }
  };

  const handleMarkComplete = async () => {
    if (!lessonId) return;
    await saveLessonProgress(lessonId, { progressPercent: 100, completed: true });
    setCompleted(true);
  };

  if (!lesson) return <div className="lesson-viewer"><div className="lesson-loading">Loading lesson…</div></div>;

  return (
    <div className="lesson-viewer">
      <header className="lesson-header">
        <button type="button" className="back-btn" onClick={() => navigate("/academy")}>← Academy</button>
        <div className="lesson-title-row">
          <h1>{lesson.title}</h1>
          {lesson.durationMinutes && <span className="reading-time">~{lesson.durationMinutes} min read</span>}
        </div>
        <div className="lesson-path">{lesson.module?.title}</div>
      </header>

      <main className="lesson-main">
        {lesson.content && (
          <div className="lesson-content markdown-body">
            <ReactMarkdown>{lesson.content}</ReactMarkdown>
          </div>
        )}

        {lesson.actionAssignmentSchema && lesson.actionAssignmentSchema.length > 0 && (
          <div className="action-assignment">
            <h2>Action Assignment</h2>
            <p className="action-intro">Apply what you learned. Your answers are saved automatically.</p>
            {lesson.actionAssignmentSchema.map((field) => (
              <div key={field.key} className="action-field">
                <label htmlFor={field.key}>{field.label}</label>
                <textarea
                  id={field.key}
                  rows={3}
                  placeholder={field.placeholder}
                  value={actionValues[field.key] ?? ""}
                  onChange={(e) => setActionValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
                <button
                  type="button"
                  className="btn-save-field"
                  onClick={() => handleSaveField(field.key, actionValues[field.key] ?? "")}
                  disabled={saving === field.key}
                >
                  {saving === field.key ? "Saving…" : "Save"}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="lesson-actions">
          {!completed && (
            <button type="button" className="btn-complete" onClick={handleMarkComplete}>
              Mark as complete
            </button>
          )}
          {completed && <p className="completed-msg">✓ Completed</p>}
        </div>

        <nav className="lesson-nav">
          {prevNext.prev ? (
            <button type="button" className="nav-btn prev" onClick={() => navigate(`/academy/lessons/${prevNext.prev!.id}`)}>
              ← {prevNext.prev.title}
            </button>
          ) : <span />}
          {prevNext.next ? (
            <button type="button" className="nav-btn next" onClick={() => navigate(`/academy/lessons/${prevNext.next!.id}`)}>
              {prevNext.next.title} →
            </button>
          ) : <span />}
        </nav>
      </main>
    </div>
  );
}
