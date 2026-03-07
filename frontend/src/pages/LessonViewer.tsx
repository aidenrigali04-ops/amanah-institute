import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { getAcademyLesson, saveLessonProgress, saveActionResponses, getLessonPrevNext, getLessonQuiz, submitLessonQuizAttempt } from "../api";
import "./LessonViewer.css";

interface ActionField {
  key: string;
  label: string;
  type: string;
  placeholder?: string;
}

interface QuizQuestion {
  id: string;
  questionText: string;
  options: string[];
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
    keyTakeaways?: string | null;
    workspaceTaskLabel?: string | null;
    workspaceTemplateSlug?: string | null;
    discussionChannelSlug?: string | null;
  } | null>(null);
  const [prevNext, setPrevNext] = useState<{ prev: { id: string; title: string } | null; next: { id: string; title: string } | null }>({ prev: null, next: null });
  const [actionValues, setActionValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<{ score: number; passed: boolean } | null>(null);

  useEffect(() => {
    if (!lessonId) return;
    getAcademyLesson(lessonId).then((l) => {
      setLesson(l);
      setActionValues(l.actionResponses || {});
      setCompleted(!!l.completedAt);
    });
    getLessonPrevNext(lessonId).then(setPrevNext);
    getLessonQuiz(lessonId).then((r) => setQuizQuestions(r.questions || []));
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

  const handleQuizSubmit = async () => {
    if (!lessonId || quizQuestions.length === 0) return;
    try {
      const result = await submitLessonQuizAttempt(lessonId, quizAnswers);
      setQuizSubmitted({ score: result.score, passed: result.passed });
    } catch {
      setQuizSubmitted({ score: 0, passed: false });
    }
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

        {lesson.keyTakeaways && (
          <div className="lesson-takeaways">
            <h2>Key Takeaways</h2>
            <div className="takeaways-body">
              <ReactMarkdown>{lesson.keyTakeaways}</ReactMarkdown>
            </div>
          </div>
        )}

        {(lesson.workspaceTaskLabel || lesson.workspaceTemplateSlug) && (
          <div className="lesson-workspace-task">
            <h2>Execution Task</h2>
            <p>{lesson.workspaceTaskLabel || "Apply this in your Workspace"}</p>
            <button type="button" className="btn-workspace" onClick={() => navigate(lesson.workspaceTemplateSlug ? `/workspace?template=${lesson.workspaceTemplateSlug}` : "/workspace")}>
              Open Workspace Template
            </button>
          </div>
        )}

        {quizQuestions.length > 0 && !quizSubmitted && (
          <div className="lesson-quiz">
            <h2>Micro Quiz</h2>
            <p className="quiz-intro">Test your knowledge ({quizQuestions.length} questions).</p>
            {quizQuestions.map((q) => (
              <div key={q.id} className="quiz-question">
                <p className="quiz-question-text">{q.questionText}</p>
                <ul className="quiz-options">
                  {q.options.map((opt, i) => (
                    <li key={i}>
                      <label>
                        <input type="radio" name={q.id} checked={quizAnswers[q.id] === i} onChange={() => setQuizAnswers((prev) => ({ ...prev, [q.id]: i }))} />
                        {opt}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <button type="button" className="btn-quiz-submit" onClick={handleQuizSubmit}>Submit Quiz</button>
          </div>
        )}
        {quizSubmitted && (
          <div className="lesson-quiz-result">
            <h2>Quiz Result</h2>
            <p className={quizSubmitted.passed ? "quiz-passed" : "quiz-failed"}>
              Score: {quizSubmitted.score}% — {quizSubmitted.passed ? "Passed" : "Review the lesson and try again."}
            </p>
          </div>
        )}

        {lesson.discussionChannelSlug && (
          <div className="lesson-discussion">
            <h2>Discussion</h2>
            <p>Ask questions or share your progress for this lesson.</p>
            <button type="button" className="btn-discussion" onClick={() => navigate(`/community?channel=${lesson.discussionChannelSlug}`)}>Join Discussion</button>
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
