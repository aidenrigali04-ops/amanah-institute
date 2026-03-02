import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register as apiRegister, checkBackendHealth, getApiUrlForDiagnostics } from "../api";
import "./Auth.css";

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"checking" | "ok" | "MISSING_API_URL" | "NETWORK_OR_CORS">("checking");

  useEffect(() => {
    let cancelled = false;
    checkBackendHealth().then((r) => {
      if (cancelled) return;
      if (r.ok) setBackendStatus("ok");
      else setBackendStatus(r.reason);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    const trimmed = name.trim();
    const spaceIndex = trimmed.indexOf(" ");
    const firstName = spaceIndex > 0 ? trimmed.slice(0, spaceIndex) : trimmed;
    const lastName = spaceIndex > 0 ? trimmed.slice(spaceIndex + 1).trim() : trimmed;
    if (!firstName) {
      setError("Please enter your name");
      return;
    }
    setLoading(true);
    try {
      const { token } = await apiRegister({
        firstName,
        lastName: lastName || firstName,
        email,
        password,
      });
      localStorage.setItem("amanah_token", token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <p className="auth-slogan">Build Wealth the Halal Way</p>
      <div className="auth-card">
        <div className="auth-logo">
          <img
            src="/amanah-logo.png"
            alt="Amanah Institute – open book and mosque dome with crescent and star; Arabic أمانة and AMANAH"
            width={140}
            height={160}
            decoding="async"
            fetchPriority="high"
          />
        </div>
        <h1 className="auth-title">Create your Account</h1>
        {backendStatus === "MISSING_API_URL" && (
          <div className="auth-banner auth-banner--warn" role="alert">
            <strong>API URL not set.</strong> In Vercel: Project → Settings → Environment Variables → add{" "}
            <code>VITE_API_URL</code> = your Railway backend URL (e.g. <code>https://xxx.up.railway.app</code>). Then
            redeploy the frontend.
          </div>
        )}
        {backendStatus === "NETWORK_OR_CORS" && (
          <div className="auth-banner auth-banner--warn" role="alert">
            <strong>Backend unreachable.</strong> Check: (1) Railway backend is running and has a public domain, (2) In
            Vercel, <code>VITE_API_URL</code> = that exact URL, (3) Redeploy frontend after changing it. URL used:{" "}
            <code>{getApiUrlForDiagnostics()}</code>
          </div>
        )}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Creating…" : "Create Account"}
          </button>
        </form>
        <p className="auth-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
