import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getDashboard } from "../api";
import "./DashboardHome.css";

type OnboardingPath = "business" | "investing" | "both" | "not_sure";

type DashboardData = {
  onboardingPath?: OnboardingPath;
  academyPersonalized?: boolean;
  tradingAccountOpened?: boolean;
  marketFeedPreview: { items: { type: string; symbol?: string; title: string; summary?: string; sentiment: string; price?: number; changePercent?: number; publishedAt: string }[]; feedPageUrl: string };
  topGainers: { period: string; items: { symbol: string; shortName?: string; price: number; changePercent: number; currency: string }[] };
  academyTopic: { id: string; title: string; summary?: string; link?: string } | null;
  toolReleases: { id: string; name: string; description?: string; category?: string; url?: string }[];
  academyDashboardUrl: string;
  testMyKnowledgeUrl: string;
  workspaceUrl: string;
  workspace: { id: string; companyName?: string; hasProjects: boolean } | null;
  chatUpdates: { communityPageUrl: string; items: { id: string; title: string; excerpt: string; channel: { name: string }; author: { firstName: string; lastName: string }; createdAt: string }[] };
  nextRecommendedAction?: { type: string; label: string; path?: string; lessonId?: string };
};

export default function DashboardHome() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topGainersPeriod, setTopGainersPeriod] = useState<"1d" | "1wk" | "1mo">("1d");

  useEffect(() => {
    let cancelled = false;
    getDashboard({ topGainersPeriod })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [topGainersPeriod]);

  if (error) {
    return (
      <div className="dashboard-home">
        <p className="dashboard-home-error">{error}</p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="dashboard-home">
        <div className="dashboard-home-loading">Loading…</div>
      </div>
    );
  }

  const feedItems = data.marketFeedPreview?.items ?? [];
  const gainers = data.topGainers?.items ?? [];
  const path: OnboardingPath = data.onboardingPath ?? "both";
  const academyDone = !!data.academyPersonalized;
  const tradingDone = !!data.tradingAccountOpened;
  const showAcademyCta = (path === "business" || path === "both" || path === "not_sure") && !academyDone;
  const showTradingCta = (path === "investing" || path === "both" || path === "not_sure") && !tradingDone;
  const showHeroCtas = showAcademyCta || showTradingCta;

  return (
    <div className="dashboard-home">
      {showHeroCtas && (
        <section className="dashboard-home-hero" aria-label="Next steps">
          {path === "investing" && showTradingCta && (
            <button type="button" className="dashboard-home-hero-btn" onClick={() => navigate("/invest/onboarding")}>
              Open My Trading Account
            </button>
          )}
          {path === "business" && showAcademyCta && (
            <button type="button" className="dashboard-home-hero-btn" onClick={() => navigate("/academy/onboarding")}>
              Personalize My Business Academy
            </button>
          )}
          {(path === "both" || path === "not_sure") && (showAcademyCta || showTradingCta) && (
            <>
              {showAcademyCta && (
                <button type="button" className="dashboard-home-hero-btn" onClick={() => navigate("/academy/onboarding")}>
                  Personalize My Business Academy
                </button>
              )}
              {showTradingCta && (
                <button type="button" className="dashboard-home-hero-btn" onClick={() => navigate("/invest/onboarding")}>
                  Open My Trading Account
                </button>
              )}
            </>
          )}
        </section>
      )}

      <div className="dashboard-home-grid">
        {/* Row 1: Market News (left) | Top Gainers + Start Trading (right) */}
        <section className="dashboard-home-card dashboard-home-card-wide" aria-labelledby="card-market-news">
          <h2 id="card-market-news" className="dashboard-home-card-title">Market News Updates</h2>
          <div className="dashboard-home-card-body">
            {feedItems.length === 0 ? (
              <p className="dashboard-home-empty">No market updates yet. Add symbols to your watchlist or check back later.</p>
            ) : (
              <ul className="dashboard-home-feed-list">
                {feedItems.slice(0, 4).map((item, i) => (
                  <li key={i}>
                    <Link to="/dashboard/feed" className={`dashboard-home-feed-item sentiment-${item.sentiment}`}>
                      {item.symbol && item.changePercent != null && (
                        <span className="dashboard-home-feed-highlight">{item.symbol} {item.changePercent >= 0 ? "+" : ""}{item.changePercent.toFixed(1)}%</span>
                      )}
                      <span className="dashboard-home-feed-title">{item.title}</span>
                      {item.summary && <span className="dashboard-home-feed-summary">{item.summary}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="dashboard-home-card" aria-labelledby="card-top-gainers">
          <h2 id="card-top-gainers" className="dashboard-home-card-title">Top Gainers Today</h2>
          <div className="dashboard-home-card-body">
            <div className="dashboard-home-gainers-control">
              <select
                value={topGainersPeriod}
                onChange={(e) => setTopGainersPeriod(e.target.value as "1d" | "1wk" | "1mo")}
                className="dashboard-home-gainers-select"
                aria-label="Time period"
              >
                <option value="1d">1 Day</option>
                <option value="1wk">1 Week</option>
                <option value="1mo">1 Month</option>
              </select>
            </div>
            {gainers.length === 0 ? (
              <p className="dashboard-home-empty">No gainers data.</p>
            ) : (
              <ul className="dashboard-home-gainers-list">
                {gainers.slice(0, 6).map((g) => (
                  <li key={g.symbol} className="dashboard-home-gainer-row">
                    <span className="dashboard-home-gainer-symbol">{g.symbol}</span>
                    <span className="dashboard-home-gainer-pct positive">+{g.changePercent.toFixed(2)}%</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/invest/trade" className="dashboard-home-cta dashboard-home-cta-primary">Start Trading</Link>
          </div>
        </section>

        {/* Row 2: Academy topic | Test My Knowledge | Go to Workspace */}
        <section className="dashboard-home-card dashboard-home-card-wide" aria-labelledby="card-academy-topic">
          <h2 id="card-academy-topic" className="dashboard-home-card-title">
            {data.academyTopic?.title ?? "How important is location for a small business?"}
          </h2>
          <div className="dashboard-home-card-body">
            <p className="dashboard-home-text">
              {data.academyTopic?.summary ?? "Geographic analysis can be a HUGE reason why businesses make or break it."}
            </p>
            <Link to={data.academyTopic?.link ?? data.academyDashboardUrl ?? "/academy"} className="dashboard-home-link">Read more →</Link>
          </div>
        </section>

        <section className="dashboard-home-card" aria-labelledby="card-test-knowledge">
          <h2 id="card-test-knowledge" className="dashboard-home-card-title">Test My Knowledge</h2>
          <div className="dashboard-home-card-body">
            <p className="dashboard-home-text">How important is branding?</p>
            <div className="dashboard-home-test-options" role="radiogroup" aria-label="Answer options">
              <span className="dashboard-home-test-dot" aria-hidden />
              <span className="dashboard-home-test-dot active" aria-hidden />
              <span className="dashboard-home-test-dot" aria-hidden />
            </div>
            <Link to={data.testMyKnowledgeUrl ?? "/academy"} className="dashboard-home-test-next" aria-label="Next question">→</Link>
          </div>
        </section>

        <section className="dashboard-home-card" aria-labelledby="card-workspace">
          <h2 id="card-workspace" className="dashboard-home-card-title">Go to Workspace</h2>
          <div className="dashboard-home-card-body">
            {data.workspace?.companyName ? (
              <p className="dashboard-home-text">{data.workspace.companyName}</p>
            ) : (
              <p className="dashboard-home-empty">Create your company branding and campaigns.</p>
            )}
            <Link to={data.workspaceUrl ?? "/workspace"} className="dashboard-home-cta dashboard-home-cta-outline">Open Workspace</Link>
          </div>
        </section>

        {/* Row 3: New Tools Release | My Academy Dashboard */}
        <section className="dashboard-home-card dashboard-home-card-wide" aria-labelledby="card-tools">
          <h2 id="card-tools" className="dashboard-home-card-title">New Tools Release</h2>
          <div className="dashboard-home-card-body">
            {!data.toolReleases?.length ? (
              <ul className="dashboard-home-tools-list">
                <li className="dashboard-home-tool-item">Loveable released new AI excelling in generating content images</li>
                <li className="dashboard-home-tool-item">ChatGPT</li>
              </ul>
            ) : (
              <ul className="dashboard-home-tools-list">
                {data.toolReleases.map((t) => (
                  <li key={t.id} className="dashboard-home-tool-item">
                    <span className="dashboard-home-tool-name">{t.name}</span>
                    {t.description && <span className="dashboard-home-tool-desc">{t.description}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="dashboard-home-card" aria-labelledby="card-academy-dash">
          <h2 id="card-academy-dash" className="dashboard-home-card-title">My Academy Dashboard</h2>
          <div className="dashboard-home-card-body">
            <p className="dashboard-home-text">Personalize your academy and track your progress.</p>
            <Link to={data.academyDashboardUrl ?? "/academy"} className="dashboard-home-cta dashboard-home-cta-primary">Go to Academy</Link>
          </div>
        </section>

        {/* Row 4: Chat Feeds | Direct Messages */}
        <section className="dashboard-home-card dashboard-home-card-half" aria-labelledby="card-chat">
          <h2 id="card-chat" className="dashboard-home-card-title">Chat Feeds</h2>
          <div className="dashboard-home-card-body">
            {!data.chatUpdates?.items?.length ? (
              <p className="dashboard-home-empty">No recent activity. Join the community.</p>
            ) : (
              <ul className="dashboard-home-chat-list">
                {data.chatUpdates.items.slice(0, 4).map((c) => (
                  <li key={c.id} className="dashboard-home-chat-item">
                    <span className="dashboard-home-chat-title">{c.title}</span>
                    <span className="dashboard-home-chat-meta">{c.author.firstName} · {c.channel.name}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to={data.chatUpdates?.communityPageUrl ?? "/community"} className="dashboard-home-link">View all →</Link>
          </div>
        </section>

        <section className="dashboard-home-card dashboard-home-card-half" aria-labelledby="card-dm">
          <h2 id="card-dm" className="dashboard-home-card-title">Direct Messages</h2>
          <div className="dashboard-home-card-body">
            <p className="dashboard-home-empty">Your DMs appear here. Start a conversation from Community.</p>
            <Link to="/community" className="dashboard-home-link">Go to Community →</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
