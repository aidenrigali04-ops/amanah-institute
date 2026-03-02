import { useState } from "react";
import { postOnboarding } from "../api";
import "./OnboardingModal.css";

export type OnboardingPath = "business" | "investing" | "both" | "not_sure";

const PATH_OPTIONS: { value: OnboardingPath; label: string }[] = [
  { value: "business", label: "Build a Business" },
  { value: "investing", label: "Trading" },
  { value: "both", label: "Both" },
  { value: "not_sure", label: "I'm Not Sure Yet" },
];

export default function OnboardingModal({ onComplete }: { onComplete: () => void }) {
  const [path, setPath] = useState<OnboardingPath | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (path == null) return;
    setError(null);
    setLoading(true);
    try {
      await postOnboarding({
        onboardingPath: path,
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
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-question">
      <div className="onboarding-modal onboarding-modal--focus">
        <h2 id="onboarding-question" className="onboarding-question">
          What are you here to focus on?
        </h2>
        <ul className="onboarding-option-list" role="listbox" aria-label="Choose your focus">
          {PATH_OPTIONS.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                role="option"
                aria-selected={path === opt.value}
                className={`onboarding-option-item ${path === opt.value ? "active" : ""}`}
                onClick={() => setPath(opt.value)}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
        {error && <p className="onboarding-error">{error}</p>}
        <div className="onboarding-actions">
          <button
            type="button"
            className="onboarding-btn primary"
            onClick={handleSubmit}
            disabled={loading || path == null}
          >
            {loading ? "Saving…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
