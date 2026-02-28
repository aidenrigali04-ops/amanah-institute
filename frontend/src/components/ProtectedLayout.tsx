import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { getOnboardingStatus } from "../api";
import OnboardingModal from "./OnboardingModal";

export default function ProtectedLayout() {
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    getOnboardingStatus()
      .then((d) => setOnboardingDone(d.onboardingDone === true))
      .catch(() => setOnboardingDone(true));
  }, []);

  const handleOnboardingComplete = () => {
    setOnboardingDone(true);
  };

  if (onboardingDone === null) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#fafafa" }}>
        <p>Loading…</p>
      </div>
    );
  }

  if (!onboardingDone) {
    return <OnboardingModal onComplete={handleOnboardingComplete} />;
  }

  return <Outlet />;
}
