import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getDashboard } from "../api";
import "./DashboardHome.css";

type DashboardData = {
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
        <p className="dashboard-error">{error}</p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="dashboard-home">
        <div className="dashboard-loading">Loading dashboard…</div>
      </div>
    );
  }

  const feedItems = data.marketFeedPreview?.items ?? [];
  const gainers = data.topGainers?.items ?? [];

  return (
    <div className="dashboard-home">
      <div className="dashboard-cards">
        {/* Row 1: Market News + Top Gainers */}
        <section className="dashboard-panel panel-wide">
          <h2 className="panel-title">Market News Updates</h2>
          <div className="panel-body">
            {feedItems.length === 0 ? (
              <p className="panel-empty">No market updates yet. Add symbols to your watchlist or check back later.</p>
            ) : (
              feedItems.slice(0, 5).map((item, i) => (
                <Link
                  to="/dashboard/feed"
                  className={`feed-item sentiment-${item.sentiment}`}
                  key={i}
                >
                  <span className="feed-title">{item.title}</span>
                  {item.summary && <span className="feed-summary">{item.summary}</span>}
                  {item.symbol && <span className="feed-symbol">{item.symbol}</span>}
                </Link>
              ))
            )}
          </div>
        </section>
        <section className="dashboard-panel">
          <h2 className="panel-title">Top Gainers Today</h2>
          <div className="panel-body">
            <div className="top-gainers-controls">
              <select
                value={topGainersPeriod}
                onChange={(e) => setTopGainersPeriod(e.target.value as "1d" | "1wk" | "1mo")}
                className="gainers-select"
              >
                <option value="1d">1 Day</option>
                <option value="1wk">1 Week</option>
                <option value="1mo">1 Month</option>
              </select>
            </div>
            {gainers.length === 0 ? (
              <p className="panel-empty">No gainers data.</p>
            ) : (
              <ul className="gainers-list">
                {gainers.slice(0, 8).map((g) => (
                  <li key={g.symbol} className="gainer-row">
                    <span className="gainer-symbol">{g.symbol}</span>
                    <span className="gainer-pct positive">+{g.changePercent.toFixed(2)}%</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/invest" className="panel-cta-btn">Start Trading</Link>
          </div>
        </section>

        {/* Row 2: Academy topic, Test knowledge, Workspace */}
        {data.academyTopic && (
          <section className="dashboard-panel">
            <h2 className="panel-title">{data.academyTopic.title}</h2>
            <div className="panel-body">
              <p className="panel-text">{data.academyTopic.summary || "Geographic analysis can be a HUGE reason why businesses make or break it."}</p>
              <Link to={data.academyTopic.link || data.academyDashboardUrl} className="panel-link">Read more →</Link>
            </div>
          </section>
        )}
        <section className="dashboard-panel">
          <h2 className="panel-title">Test My Knowledge</h2>
          <div className="panel-body">
            <p className="panel-text">How important is branding?</p>
            <div className="test-dots">
              <span className="dot" /><span className="dot active" /><span className="dot" />
            </div>
            <Link to={data.testMyKnowledgeUrl || "/academy/test"} className="panel-arrow">→</Link>
          </div>
        </section>
        <section className="dashboard-panel">
          <h2 className="panel-title">Go to Workspace</h2>
          <div className="panel-body">
            {data.workspace?.companyName ? (
              <p className="panel-text">{data.workspace.companyName}</p>
            ) : (
              <p className="panel-empty">Create your company branding and campaigns.</p>
            )}
            <Link to={data.workspaceUrl || "/workspace"} className="panel-cta-btn outline">Open Workspace</Link>
          </div>
        </section>

        {/* Row 3: New Tools, My Academy Dashboard */}
        <section className="dashboard-panel panel-wide">
          <h2 className="panel-title">New Tools Release</h2>
          <div className="panel-body">
            {data.toolReleases?.length === 0 ? (
              <p className="panel-empty">No new tools.</p>
            ) : (
              <ul className="tools-list">
                {data.toolReleases?.map((t) => (
                  <li key={t.id} className="tool-item">
                    <span className="tool-name">{t.name}</span>
                    {t.description && <span className="tool-desc">{t.description}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section className="dashboard-panel">
          <h2 className="panel-title">My Academy Dashboard</h2>
          <div className="panel-body">
            <p className="panel-text">Personalize your academy and track your progress.</p>
            <Link to={data.academyDashboardUrl || "/academy"} className="panel-cta-btn">Personalize Academy (recommended)</Link>
          </div>
        </section>

        {/* Row 4: Chat Feeds, Direct Messages */}
        <section className="dashboard-panel panel-wide">
          <h2 className="panel-title">Chat Feeds</h2>
          <div className="panel-body">
            {data.chatUpdates?.items?.length === 0 ? (
              <p className="panel-empty">No recent activity. Join the community.</p>
            ) : (
              <ul className="chat-list">
                {data.chatUpdates?.items?.slice(0, 4).map((c) => (
                  <li key={c.id} className="chat-item">
                    <span className="chat-title">{c.title}</span>
                    <span className="chat-meta">{c.author.firstName} · {c.channel.name}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to={data.chatUpdates?.communityPageUrl || "/community"} className="panel-link">View all →</Link>
          </div>
        </section>
        <section className="dashboard-panel panel-wide">
          <h2 className="panel-title">Direct Messages</h2>
          <div className="panel-body">
            <p className="panel-empty">Your DMs appear here. Start a conversation from Community.</p>
            <Link to="/community" className="panel-link">Go to Community →</Link>
          </div>
        </section>
      </div>

      {/* In-dashboard onboarding CTAs */}
      <section className="dashboard-onboarding-ctas">
        <div className="onboarding-cta-card highlight">
          <h3>Personalize my academy</h3>
          <p>Recommended for the best experience. Set your path, goals, and see a tailored dashboard.</p>
          <button type="button" className="panel-cta-btn" onClick={() => navigate("/academy")}>
            Personalize Academy
          </button>
        </div>
        <div className="onboarding-cta-card">
          <h3>Open trading account</h3>
          <p>Fund your account and start trading halal-compliant stocks.</p>
          <button type="button" className="panel-cta-btn outline" onClick={() => navigate("/invest")}>
            Open Trading Account
          </button>
        </div>
      </section>
    </div>
  );
}
