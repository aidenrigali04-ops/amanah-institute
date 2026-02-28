import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register as apiRegister } from "../api";
import "./Auth.css";

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      navigate("/academy", { replace: true });
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
