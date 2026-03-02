import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getPortfolio, getOnboardingStatus } from "../api";
import "./TradingPortfolio.css";

const CHART_RANGE_LABELS: Record<string, string> = {
  "1d": "1D",
  "1w": "1W",
  "1m": "1M",
  "3m": "3M",
  "1y": "1Y",
  all: "All",
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatPercent(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export default function TradingPortfolio() {
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof getPortfolio>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<string>("1m");

  useEffect(() => {
    let cancelled = false;
    getOnboardingStatus()
      .then((s) => {
        if (cancelled) return;
        if (!s.tradingAccountOpened) {
          navigate("/invest/onboarding", { replace: true });
          return;
        }
        return getPortfolio();
      })
      .then((d) => {
        if (cancelled || !d) return;
        setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="trading-portfolio">
        <div className="trading-portfolio-loading">Loading account…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="trading-portfolio">
        <div className="trading-portfolio-error">{error || "Unable to load portfolio."}</div>
      </div>
    );
  }

  const { snapshot, chartData, positions, exposure, watchlistPreview, recentActivity } = data;

  return (
    <div className="trading-portfolio">
      {/* 1. Portfolio Snapshot + Chart */}
      <section className="trading-snapshot" aria-label="Portfolio snapshot">
        <div className="trading-snapshot-grid">
          <div className="trading-snapshot-item">
            <span className="trading-snapshot-label">Total Account Value</span>
            <span className="trading-snapshot-value">{formatCents(snapshot.totalAccountValueCents)}</span>
          </div>
          <div className="trading-snapshot-item">
            <span className="trading-snapshot-label">Cash Available</span>
            <span className="trading-snapshot-value">{formatCents(snapshot.cashAvailableCents)}</span>
          </div>
          <div className="trading-snapshot-item">
            <span className="trading-snapshot-label">Today’s P&L</span>
            <span className={`trading-snapshot-value ${snapshot.todayPnlCents >= 0 ? "positive" : "negative"}`}>
              {formatCents(snapshot.todayPnlCents)}
            </span>
          </div>
          <div className="trading-snapshot-item">
            <span className="trading-snapshot-label">All-Time P&L</span>
            <span className={`trading-snapshot-value ${snapshot.allTimePnlCents >= 0 ? "positive" : "negative"}`}>
              {formatCents(snapshot.allTimePnlCents)}
            </span>
          </div>
        </div>
        <div className="trading-chart-wrap">
          <div className="trading-chart-toggles">
            {data.chartRanges.map((r) => (
              <button
                key={r}
                type="button"
                className={`trading-chart-toggle ${chartRange === r ? "active" : ""}`}
                onClick={() => setChartRange(r)}
              >
                {CHART_RANGE_LABELS[r] ?? r}
              </button>
            ))}
          </div>
          <div className="trading-chart-mini" aria-hidden>
            {chartData.length > 0 && (
              <div
                className="trading-chart-bar"
                style={{
                  height: "40px",
                  width: "100%",
                  background: "linear-gradient(90deg, #e8f5e9 0%, #2e7d32 100%)",
                  borderRadius: "6px",
                }}
              />
            )}
            {chartData.length === 0 && <div className="trading-chart-placeholder">No history yet</div>}
          </div>
        </div>
      </section>

      <div className="trading-main-layout">
        {/* 2. Open Positions (primary) */}
        <section className="trading-positions" aria-label="Open positions">
          <h2 className="trading-section-title">Open Positions</h2>
          {positions.length === 0 ? (
            <p className="trading-empty">
              No positions. <Link to="/invest/trade">Open a trade from Market</Link>.
            </p>
          ) : (
            <div className="trading-table-wrap">
              <table className="trading-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Company</th>
                    <th className="trading-num">Quantity</th>
                    <th className="trading-num">Avg Cost</th>
                    <th className="trading-num">Current Price</th>
                    <th className="trading-num">Unrealized P&L</th>
                    <th>Compliance</th>
                    <th aria-hidden className="trading-menu-col" />
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr
                      key={p.ticker}
                      className="trading-row"
                      onClick={() => navigate(`/invest/stock/${p.ticker}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/invest/stock/${p.ticker}`);
                        }
                      }}
                    >
                      <td className="trading-ticker">{p.ticker}</td>
                      <td className="trading-company">{p.companyName}</td>
                      <td className="trading-num">{p.quantity.toLocaleString()}</td>
                      <td className="trading-num">${(p.avgCostCents / 100).toFixed(2)}</td>
                      <td className="trading-num">${p.currentPrice.toFixed(2)}</td>
                      <td className="trading-num">
                        <span className={p.unrealizedPnlCents >= 0 ? "positive" : "negative"}>
                          {formatCents(p.unrealizedPnlCents)} ({formatPercent(p.unrealizedPnlPercent)})
                        </span>
                      </td>
                      <td>
                        <span className="trading-badge">{p.complianceBadge}</span>
                      </td>
                      <td className="trading-menu-col" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="trading-row-menu"
                          aria-label="Row menu"
                          title="Add note, Sell, Set alert"
                        >
                          ⋯
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 3. Exposure + Watchlist (side/below) */}
        <aside className="trading-side">
          <section className="trading-exposure" aria-label="Exposure">
            <h2 className="trading-section-title trading-section-title--small">Exposure</h2>
            <dl className="trading-exposure-list">
              <div>
                <dt>Largest Position</dt>
                <dd className={exposure.largestPositionWarning ? "trading-exposure-warn" : ""}>
                  {exposure.largestPositionPercent}%
                  {exposure.largestPositionWarning && (
                    <span className="trading-exposure-warn-icon" title="Over 35%"> ⚠</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Sector Concentration</dt>
                <dd>{exposure.sectorConcentrationPercent != null ? `${exposure.sectorConcentrationPercent}%` : "—"}</dd>
              </div>
              <div>
                <dt>Cash Allocation</dt>
                <dd>{exposure.cashAllocationPercent}%</dd>
              </div>
            </dl>
          </section>

          <section className="trading-watchlist-preview" aria-label="Watchlist preview">
            <h2 className="trading-section-title trading-section-title--small">Watchlist</h2>
            {watchlistPreview.length === 0 ? (
              <p className="trading-empty trading-empty--small">No symbols watched.</p>
            ) : (
              <ul className="trading-watchlist-list">
                {watchlistPreview.map((w) => (
                  <li key={w.ticker} className="trading-watchlist-item">
                    <Link to={`/invest/stock/${w.ticker}`} className="trading-watchlist-link">
                      <span className="trading-watchlist-ticker">{w.ticker}</span>
                      <span className="trading-watchlist-price">${w.price.toFixed(2)}</span>
                      <span className={`trading-watchlist-pct ${w.sentiment}`}>
                        {formatPercent(w.changePercent)}
                      </span>
                      <span className="trading-watchlist-arrow" aria-hidden>
                        {w.sentiment === "positive" ? "↑" : w.sentiment === "negative" ? "↓" : "−"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/invest/trade" className="trading-watchlist-btn">
              Full Watchlist
            </Link>
          </section>
        </aside>
      </div>

      {/* 4. Recent Activity */}
      <section className="trading-activity" aria-label="Recent activity">
        <h2 className="trading-section-title trading-section-title--small">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <p className="trading-empty trading-empty--small">No trades yet.</p>
        ) : (
          <ul className="trading-activity-list">
            {recentActivity.map((a, i) => (
              <li key={`${a.date}-${a.ticker}-${i}`} className="trading-activity-item">
                <span className={`trading-activity-type ${a.type}`}>{a.type === "buy" ? "Buy" : "Sell"}</span>
                <span className="trading-activity-ticker">{a.ticker}</span>
                <span className="trading-activity-date">
                  {new Date(a.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span className="trading-activity-amount">{formatCents(a.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/invest/transactions" className="trading-activity-link">
          Full Transactions
        </Link>
      </section>
    </div>
  );
}
