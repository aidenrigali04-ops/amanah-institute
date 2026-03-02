import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getOnboardingStatus, postOnboardingTrading } from "../api";
import "./TradingOnboarding.css";

const RISK_OPTIONS = [
  { value: "conservative" as const, label: "Conservative", desc: "Lower risk, steadier returns" },
  { value: "balanced" as const, label: "Balanced", desc: "Mix of growth and stability" },
  { value: "growth" as const, label: "Growth", desc: "Higher potential, more volatility" },
];

export default function TradingOnboarding() {
  const navigate = useNavigate();
  const [riskProfile, setRiskProfile] = useState<"conservative" | "balanced" | "growth" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOnboardingStatus().then((s) => {
      if (s.tradingAccountOpened) navigate("/invest", { replace: true });
    }).catch(() => {});
  }, [navigate]);

  const handleSubmit = async () => {
    if (!riskProfile) return;
    setError(null);
    setLoading(true);
    try {
      await postOnboardingTrading({ riskProfile });
      navigate("/invest", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="trading-onboarding-page">
      <div className="trading-onboarding-card onboarding-card--focus">
        <h1 className="trading-onboarding-title">Open Your Trading Account</h1>
        <p className="trading-onboarding-subtitle">Choose your risk profile. We’ll create your Holding, Automated, and Self-Directed accounts.</p>

        <section className="trading-onboarding-step" aria-label="Risk profile">
          <h2 className="trading-onboarding-question">What is your risk tolerance?</h2>
          <ul className="trading-onboarding-options" role="listbox" aria-label="Risk profile">
            {RISK_OPTIONS.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={riskProfile === opt.value}
                  className={`trading-onboarding-option ${riskProfile === opt.value ? "active" : ""}`}
                  onClick={() => setRiskProfile(opt.value)}
                >
                  <span className="trading-onboarding-option-label">{opt.label}</span>
                  <span className="trading-onboarding-option-desc">{opt.desc}</span>
                </button>
              </li>
            ))}
          </ul>
          {error && <p className="trading-onboarding-error">{error}</p>}
          <div className="trading-onboarding-actions">
            <button
              type="button"
              className="trading-onboarding-btn primary"
              onClick={handleSubmit}
              disabled={loading || !riskProfile}
            >
              {loading ? "Opening account…" : "Open My Trading Account"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
