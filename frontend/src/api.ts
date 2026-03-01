/** Base URL for API. In dev with Vite proxy use "" so /api goes to backend. In production set VITE_API_URL to your backend (e.g. https://your-app.up.railway.app). */
function getApiBase(): string {
  const raw = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}
const API = getApiBase();

/** Call from auth pages to verify backend is reachable. */
export async function checkBackendHealth(): Promise<{ ok: true } | { ok: false; reason: "MISSING_API_URL" | "NETWORK_OR_CORS" }> {
  if (!API) return { ok: false, reason: "MISSING_API_URL" };
  try {
    const res = await fetch(`${API}/health`, { method: "GET", cache: "no-store" });
    if (res.ok) return { ok: true };
    return { ok: false, reason: "NETWORK_OR_CORS" };
  } catch {
    return { ok: false, reason: "NETWORK_OR_CORS" };
  }
}

export function getApiUrlForDiagnostics(): string {
  return API || "(not set – add VITE_API_URL in Vercel)";
}

function getToken(): string | null {
  return localStorage.getItem("amanah_token");
}

function headers(): HeadersInit {
  const t = getToken();
  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

export async function login(email: string, password: string) {
  let res: Response;
  try {
    res = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error(
      "Login failed: cannot reach server. On Vercel, set VITE_API_URL to your Railway URL and redeploy."
    );
  }
  if (!res.ok) {
    if (res.status === 404) {
      const text = await res.text();
      const isHtml = /<!doctype html>/i.test(text) || text.trimStart().startsWith("<");
      throw new Error(
        isHtml
          ? "Login failed: request hit wrong server (404). Set VITE_API_URL in Vercel to your Railway URL and redeploy."
          : "Login failed: server not reachable (404)."
      );
    }
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || "Login failed");
  }
  return res.json();
}

export async function register(data: { email: string; password: string; firstName: string; lastName: string }) {
  const url = `${API}/api/auth/register`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(data),
    });
  } catch {
    const hint = !API
      ? "Set VITE_API_URL in Vercel to your Railway URL, then redeploy."
      : "Check: (1) Railway backend is running and has a public domain, (2) VITE_API_URL in Vercel is that exact URL, (3) Redeploy frontend after changing env.";
    throw new Error(`Registration failed: cannot reach server. ${hint}`);
  }
  if (!res.ok) {
    if (res.status === 404) {
      const text = await res.text();
      const isHtml = /<!doctype html>/i.test(text) || text.trimStart().startsWith("<");
      throw new Error(
        isHtml
          ? "Registration failed: request hit the wrong server (404). In Vercel, add env var VITE_API_URL = your Railway backend URL (e.g. https://amanah-production-e280.up.railway.app), then redeploy."
          : "Registration failed: server not reachable (404). Set VITE_API_URL in Vercel and redeploy."
      );
    }
    const e = await res.json().catch(() => ({}));
    const msg = e.error || (e.errors?.[0]?.msg) || "Registration failed";
    throw new Error(msg);
  }
  return res.json();
}

export async function getQuote(symbol: string) {
  const res = await fetch(`${API}/api/invest/market/${encodeURIComponent(symbol)}/quote`, { headers: headers() });
  if (!res.ok) return null;
  return res.json();
}

export async function getOHLC(symbol: string, interval: string = "1d", range: string = "1mo") {
  const params = new URLSearchParams({ interval, range });
  const res = await fetch(`${API}/api/invest/market/${encodeURIComponent(symbol)}/ohlc?${params}`, { headers: headers() });
  if (!res.ok) return { data: [] };
  return res.json();
}

export async function getSymbols() {
  const res = await fetch(`${API}/api/invest/symbols`, { headers: headers() });
  if (!res.ok) return [];
  const j = await res.json();
  return j.symbols || [];
}

export async function getWatchlist() {
  const res = await fetch(`${API}/api/invest/watchlist`, { headers: headers() });
  if (!res.ok) return [];
  const j = await res.json();
  return j.watchlist || [];
}

export async function addWatchlist(symbol: string) {
  const res = await fetch(`${API}/api/invest/watchlist`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ symbol }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || "Failed to add");
  }
  return res.json();
}

export async function removeWatchlist(symbol: string) {
  const res = await fetch(`${API}/api/invest/watchlist/${encodeURIComponent(symbol)}`, { method: "DELETE", headers: headers() });
  if (!res.ok) throw new Error("Failed to remove");
}

export async function getHoldings(accountId?: string) {
  const url = accountId ? `${API}/api/invest/holdings?accountId=${accountId}` : `${API}/api/invest/holdings`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) return [];
  const j = await res.json();
  return j.holdings || [];
}

export async function getAccounts() {
  const res = await fetch(`${API}/api/invest/accounts`, { headers: headers() });
  if (!res.ok) return [];
  const j = await res.json();
  return j.accounts || [];
}

export async function placeBuy(symbol: string, quantity: number, priceCents: number, accountId?: string) {
  const res = await fetch(`${API}/api/invest/orders/buy`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ symbol, quantity, priceCents, accountId }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "Buy failed");
  return j;
}

export async function placeSell(symbol: string, quantity: number, priceCents: number, accountId?: string) {
  const res = await fetch(`${API}/api/invest/orders/sell`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ symbol, quantity, priceCents, accountId }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "Sell failed");
  return j;
}

export async function getOrders(limit?: number) {
  const url = limit ? `${API}/api/invest/orders?limit=${limit}` : `${API}/api/invest/orders`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) return [];
  const j = await res.json();
  return j.orders || [];
}

// ─── Academy (Amanah Wealth Academy) ────────────────────────────────────────
export async function getAcademyDashboard() {
  const res = await fetch(`${API}/api/academy/dashboard`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to load dashboard");
  return res.json();
}

export async function getAcademyLesson(lessonId: string) {
  const res = await fetch(`${API}/api/academy/lessons/${lessonId}`, { headers: headers() });
  if (!res.ok) throw new Error("Lesson not found");
  return res.json();
}

export async function saveLessonProgress(lessonId: string, data: { progressPercent?: number; completed?: boolean }) {
  const res = await fetch(`${API}/api/academy/lessons/${lessonId}/progress`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save progress");
  return res.json();
}

export async function saveActionResponses(lessonId: string, responses: Record<string, string>) {
  const res = await fetch(`${API}/api/academy/lessons/${lessonId}/action`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ responses }),
  });
  if (!res.ok) throw new Error("Failed to save");
  return res.json();
}

export async function getLessonPrevNext(lessonId: string) {
  const res = await fetch(`${API}/api/academy/lessons/${lessonId}/prev-next`, { headers: headers() });
  if (!res.ok) return { prev: null, next: null };
  return res.json();
}

export async function getAcademyBadges() {
  const res = await fetch(`${API}/api/academy/badges`, { headers: headers() });
  if (!res.ok) return [];
  const j = await res.json();
  return j.badges || [];
}

export async function setTheme(theme: "light" | "dark") {
  const res = await fetch(`${API}/api/profile`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ theme }),
  });
  if (!res.ok) throw new Error("Failed to save theme");
  return res.json();
}

export async function getProfile() {
  const res = await fetch(`${API}/api/profile`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json();
}

// ─── Dashboard (home overview) ───────────────────────────────────────────────
export async function getDashboard(params?: { topGainersPeriod?: string }) {
  const q = params?.topGainersPeriod ? `?topGainersPeriod=${params.topGainersPeriod}` : "";
  const res = await fetch(`${API}/api/dashboard${q}`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to load dashboard");
  return res.json();
}

export async function getDashboardFeed(params?: { limit?: number; live?: boolean }) {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.live === false) sp.set("live", "0");
  const q = sp.toString() ? `?${sp}` : "";
  const res = await fetch(`${API}/api/dashboard/feed${q}`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to load feed");
  return res.json();
}

// ─── Onboarding (3 questions) ────────────────────────────────────────────────
export async function getOnboardingStatus() {
  const res = await fetch(`${API}/api/onboarding/status`, { headers: headers() });
  if (!res.ok) return { onboardingDone: false };
  return res.json();
}

export async function postOnboarding(data: {
  onboardingPath?: "business" | "investing" | "both";
  experienceLevel?: "beginner" | "intermediate" | "advanced";
  riskProfile?: "conservative" | "balanced" | "growth";
  goals?: string;
  complete?: boolean;
}) {
  const res = await fetch(`${API}/api/onboarding`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || "Failed to save");
  }
  return res.json();
}
