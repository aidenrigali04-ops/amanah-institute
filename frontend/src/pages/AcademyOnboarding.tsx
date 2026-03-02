import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getOnboardingStatus, postOnboardingAcademy } from "../api";
import "./AcademyOnboarding.css";

const EXPERIENCE_OPTIONS = [
  { value: "beginner" as const, label: "Beginner" },
  { value: "intermediate" as const, label: "Intermediate" },
  { value: "advanced" as const, label: "Advanced" },
];

const PATHWAY_OPTIONS = [
  { value: "starter" as const, label: "Starter" },
  { value: "builder" as const, label: "Builder" },
  { value: "scaler" as const, label: "Scaler" },
];

const STAGE_OPTIONS = [
  { value: "pre_revenue" as const, label: "Pre-revenue (idea stage)" },
  { value: "first_offer" as const, label: "First offer built" },
  { value: "first_client" as const, label: "First client" },
  { value: "revenue_1k" as const, label: "Hitting $1k/month" },
  { value: "systemized" as const, label: "Systemized & scaling" },
];

export default function AcademyOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    experienceLevel?: "beginner" | "intermediate" | "advanced";
    pathway?: "starter" | "builder" | "scaler";
    incomeGoalMonthlyCents?: number;
    incomeGoalPeriodMonths?: number;
    currentStage?: "pre_revenue" | "first_offer" | "first_client" | "revenue_1k" | "systemized";
    goals?: string;
  }>({});

  useEffect(() => {
    getOnboardingStatus().then((s) => {
      if (s.academyPersonalized) navigate("/academy", { replace: true });
    }).catch(() => {});
  }, [navigate]);

  const canNextStep1 = !!form.experienceLevel;
  const canNextStep2 = !!form.pathway;
  const canSubmit = canNextStep1 && canNextStep2;

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await postOnboardingAcademy({
        experienceLevel: form.experienceLevel,
        pathway: form.pathway,
        incomeGoalMonthlyCents: form.incomeGoalMonthlyCents,
        incomeGoalPeriodMonths: form.incomeGoalPeriodMonths ?? 6,
        currentStage: form.currentStage,
        goals: form.goals || undefined,
      });
      navigate("/academy", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="academy-onboarding-page">
      <div className="academy-onboarding-card onboarding-card--focus">
        <h1 className="academy-onboarding-title">Personalize Your Business Academy</h1>
        <p className="academy-onboarding-subtitle">Answer a few questions so we can tailor your learning path.</p>

        {step === 1 && (
          <section className="academy-onboarding-step" aria-label="Experience level">
            <h2 className="academy-onboarding-question">What is your experience level?</h2>
            <ul className="academy-onboarding-options" role="listbox" aria-label="Experience level">
              {EXPERIENCE_OPTIONS.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={form.experienceLevel === opt.value}
                    className={`academy-onboarding-option ${form.experienceLevel === opt.value ? "active" : ""}`}
                    onClick={() => setForm((f) => ({ ...f, experienceLevel: opt.value }))}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
            <div className="academy-onboarding-actions">
              <button type="button" className="academy-onboarding-btn primary" onClick={() => setStep(2)} disabled={!canNextStep1}>
                Next
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="academy-onboarding-step" aria-label="Pathway and goals">
            <h2 className="academy-onboarding-question">Which pathway fits you best?</h2>
            <ul className="academy-onboarding-options" role="listbox" aria-label="Pathway">
              {PATHWAY_OPTIONS.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={form.pathway === opt.value}
                    className={`academy-onboarding-option ${form.pathway === opt.value ? "active" : ""}`}
                    onClick={() => setForm((f) => ({ ...f, pathway: opt.value }))}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
            <h2 className="academy-onboarding-question academy-onboarding-question--secondary">Where are you in your journey?</h2>
            <ul className="academy-onboarding-options" role="listbox" aria-label="Current stage">
              {STAGE_OPTIONS.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={form.currentStage === opt.value}
                    className={`academy-onboarding-option ${form.currentStage === opt.value ? "active" : ""}`}
                    onClick={() => setForm((f) => ({ ...f, currentStage: opt.value }))}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
            <div className="academy-onboarding-inline">
              <label className="academy-onboarding-label">
                Monthly income goal (6 months) — optional
              </label>
              <div className="academy-onboarding-row">
                <span className="academy-onboarding-currency">$</span>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 3000"
                  className="academy-onboarding-input"
                  value={form.incomeGoalMonthlyCents ? form.incomeGoalMonthlyCents / 100 : ""}
                  onChange={(e) => {
                    const v = e.target.value ? Math.round(Number(e.target.value) * 100) : undefined;
                    setForm((f) => ({ ...f, incomeGoalMonthlyCents: v }));
                  }}
                />
                <span className="academy-onboarding-suffix">/month</span>
              </div>
            </div>
            <label className="academy-onboarding-label">Goals (optional)</label>
            <textarea
              className="academy-onboarding-textarea"
              placeholder="e.g. Launch my first offer, land 3 clients..."
              rows={2}
              value={form.goals ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, goals: e.target.value.trim() || undefined }))}
            />
            {error && <p className="academy-onboarding-error">{error}</p>}
            <div className="academy-onboarding-actions academy-onboarding-actions--multi">
              <button type="button" className="academy-onboarding-btn secondary" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                type="button"
                className="academy-onboarding-btn primary"
                onClick={handleSubmit}
                disabled={loading || !canSubmit}
              >
                {loading ? "Saving…" : "Complete & go to Academy"}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
