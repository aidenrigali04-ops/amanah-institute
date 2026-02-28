import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getDashboardFeed } from "../api";
import "./FeedPage.css";

export default function FeedPage() {
  const [data, setData] = useState<{ sections?: { section: string; items: unknown[] }[]; allItems?: unknown[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardFeed({ limit: 50 })
      .then(setData)
      .catch(() => setData({ sections: [], allItems: [] }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="feed-page"><p>Loading feed…</p></div>;
  const sections = data?.sections ?? [];
  return (
    <div className="feed-page">
      <div className="feed-header">
        <h1>Market & News Feed</h1>
        <Link to="/dashboard" className="feed-back">← Dashboard</Link>
      </div>
      {sections.map((sec) => (
        <section key={sec.section} className="feed-section">
          <h2>{sec.section === "watchlist" ? "Watchlist" : "Recommended"}</h2>
          <ul className="feed-list">
            {(sec.items as { title?: string; summary?: string; sentiment?: string; symbol?: string }[]).map((item, i) => (
              <li key={i} className={`feed-list-item sentiment-${item.sentiment ?? "neutral"}`}>
                <span className="feed-list-title">{item.title}</span>
                {item.summary && <span className="feed-list-summary">{item.summary}</span>}
                {item.symbol && <span className="feed-list-symbol">{item.symbol}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
