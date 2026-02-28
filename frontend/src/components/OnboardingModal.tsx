import { useState } from "react";
import { postOnboarding } from "../api";
import "./OnboardingModal.css";

type Step = 1 | 2 | 3;

export default function OnboardingModal({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [path, setPath] = useState<"business" | "investing" | "both">("both");
  const [experience, setExperience] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [goals, setGoals] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = async () => {
    setError(null);
    if (step < 3) {
      setStep((s) => (s + 1) as Step);
      return;
    }
    setLoading(true);
    try {
      await postOnboarding({
        onboardingPath: path,
        experienceLevel: experience,
        goals: goals.trim() || undefined,
        complete: true,
      });
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-modal">
        <h1 id="onboarding-title" className="onboarding-title">Welcome to Amanah Institute</h1>
        <p className="onboarding-subtitle">Three quick questions to personalize your experience.</p>

        {step === 1 && (
          <div className="onboarding-step">
            <label className="onboarding-label">What’s your main focus?</label>
            <div className="onboarding-options">
              {(["business", "investing", "both"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`onboarding-option ${path === opt ? "active" : ""}`}
                  onClick={() => setPath(opt)}
                >
                  {opt === "business" && "Business"}
                  {opt === "investing" && "Investing"}
                  {opt === "both" && "Both"}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-step">
            <label className="onboarding-label">What’s your experience level?</label>
            <div className="onboarding-options">
              {(["beginner", "intermediate", "advanced"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`onboarding-option ${experience === opt ? "active" : ""}`}
                  onClick={() => setExperience(opt)}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-step">
            <label className="onboarding-label">What’s your main goal? (optional)</label>
            <input
              type="text"
              className="onboarding-input"
              placeholder="e.g. Build a side business, invest halal, save for hajj"
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
            />
          </div>
        )}

        {error && <p className="onboarding-error">{error}</p>}
        <div className="onboarding-actions">
          <button
            type="button"
            className="onboarding-btn primary"
            onClick={handleNext}
            disabled={loading}
          >
            {loading ? "Saving…" : step < 3 ? "Next" : "Get started"}
          </button>
        </div>
        <p className="onboarding-hint">You can personalize your academy and open a trading account from your dashboard.</p>
      </div>
    </div>
  );
}
