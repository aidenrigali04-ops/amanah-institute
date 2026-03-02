import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login, checkBackendHealth, getApiUrlForDiagnostics } from "../api";
import "./Auth.css";

export default function Login() {
  const navigate = useNavigate();
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
    setLoading(true);
    try {
      const { token } = await login(email, password);
      localStorage.setItem("amanah_token", token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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
        <h1 className="auth-title">Log in</h1>
        {backendStatus === "MISSING_API_URL" && (
          <div className="auth-banner auth-banner--warn" role="alert">
            <strong>API URL not set.</strong> In Vercel: add <code>VITE_API_URL</code> = your Railway backend URL, then
            redeploy.
          </div>
        )}
        {backendStatus === "NETWORK_OR_CORS" && (
          <div className="auth-banner auth-banner--warn" role="alert">
            <strong>Backend unreachable.</strong> Check Railway is running and <code>VITE_API_URL</code> in Vercel
            matches. URL: <code>{getApiUrlForDiagnostics()}</code>
          </div>
        )}
        <form onSubmit={handleSubmit} className="auth-form">
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
              autoComplete="current-password"
            />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="auth-footer">
          Don’t have an account? <Link to="/register">Create account</Link>
        </p>
      </div>
    </div>
  );
}
