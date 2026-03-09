import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getPortfolio, getTransactions } from "../api";
import { useProfile } from "../hooks/useProfile";
import "./TradingOverview.css";

const formatMoney = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function TradingOverview() {
  const navigate = useNavigate();
  const { displayName } = useProfile();
  const [portfolio, setPortfolio] = useState<Awaited<ReturnType<typeof getPortfolio>> | null>(null);
  const [transactions, setTransactions] = useState<{ id: string; type: string; symbol: string | null; amountCents: number; quantity: number | null; priceCents: number | null; status: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange] = useState("Feb 03 - March 03, 2025");

  useEffect(() => {
    Promise.all([getPortfolio().catch(() => null), getTransactions(20)])
      .then(([p, txList]) => {
        setPortfolio(p || null);
        setTransactions(Array.isArray(txList) ? txList : []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="to-page"><div className="to-loading">Loading…</div></div>;
  }

  const snapshot = portfolio?.snapshot ?? { totalAccountValueCents: 0, cashAvailableCents: 0, todayPnlCents: 0, allTimePnlCents: 0, currency: "USD" };
  const totalCents = snapshot.totalAccountValueCents;
  const pnlCents = snapshot.allTimePnlCents ?? 0;
  const pnlPercent = totalCents > 0 ? ((pnlCents / (totalCents - pnlCents)) * 100) : 0;
  const positions = portfolio?.positions ?? [];
  const recentActivity = portfolio?.recentActivity ?? [];
  const watchlistPreview = portfolio?.watchlistPreview ?? [];

  const assetAllocation = positions.length > 0
    ? positions.map((p) => ({ name: p.ticker, value: p.quantity * p.currentPrice * 100 }))
    : watchlistPreview.slice(0, 4).map((w) => ({ name: w.ticker, value: 0 }));

  const trendingTicker = watchlistPreview[0] || positions[0];
  const trendingChange = trendingTicker ? ("changePercent" in trendingTicker ? trendingTicker.changePercent : (positions[0]?.unrealizedPnlPercent ?? 0)) : 0;

  return (
    <div className="to-page">
      <header className="to-header">
        <div className="to-breadcrumb">Dashboard / Overview</div>
        <div className="to-header-right">
          <div className="to-search-wrap">
            <span className="to-search-icon">⌕</span>
            <input type="text" className="to-search" placeholder="Search" />
          </div>
          <button type="button" className="to-icon-btn" aria-label="Notifications">🔔</button>
          <span className="to-date">{dateRange}</span>
        </div>
      </header>

      <div className="to-welcome">
        <h1>Hello {displayName}! 👋</h1>
        <p>Let's check how your assets are performing today.</p>
      </div>

      <div className="to-grid">
        <div className="to-card to-card-asset">
          <h2>Your Asset</h2>
          <p className="to-card-date">{dateRange}</p>
          <div className="to-card-actions">
            <button type="button" className="to-btn to-btn-outline">Pull Out</button>
            <button type="button" className="to-btn to-btn-outline" onClick={() => navigate("/dashboard")}>Deposit</button>
          </div>
          <p className="to-total-value">{formatMoney(totalCents)}</p>
          <p className={`to-pnl ${pnlCents >= 0 ? "to-pnl--pos" : "to-pnl--neg"}`}>
            {pnlCents >= 0 ? "+" : ""}{formatMoney(pnlCents)} ({pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%)
          </p>
          <p className="to-encourage">You're doing great! Keep it up 🌈</p>
          <div className="to-metrics">
            <div className="to-metric"><span className="to-metric-icon">📈</span> 2.34% Monthly Performance</div>
            <div className="to-metric"><span className="to-metric-icon">⭕</span> 64% Asset Efficiency</div>
            <div className="to-metric"><span className="to-metric-icon">🛡</span> 0.64 Market Resilience</div>
            <div className="to-metric"><span className="to-metric-icon">💎</span> 71/100 Financial Strength</div>
          </div>
        </div>

        <div className="to-card to-card-overview">
          <h2>Asset Overview <span className="to-arrow">→</span></h2>
          <div className="to-donut-wrap">
            <div className="to-donut">
              <span className="to-donut-center">${(totalCents / 100).toFixed(0)}+</span>
            </div>
            <div className="to-donut-legend">
              {assetAllocation.slice(0, 4).map((a, i) => (
                <span key={a.name} className="to-legend-dot" style={{ background: ["#f59e0b", "#3b82f6", "#8b5cf6", "#1e3a8a"][i] }} />)
              )}
              {["Ethereum", "Cardano", "Solana", "Bitcoin"].slice(0, assetAllocation.length).map((l, i) => (
                <span key={i}>{assetAllocation[i]?.name || l}</span>
              ))}
            </div>
          </div>
          <div className="to-mini-cards">
            {positions.slice(0, 4).map((pos) => (
              <div key={pos.ticker} className="to-mini-card">
                <div className="to-mini-header">
                  <span className="to-mini-ticker">{pos.ticker}</span>
                  <span className="to-mini-name">{pos.companyName}</span>
                </div>
                <p className="to-mini-value">${(pos.currentPrice * pos.quantity).toFixed(2)}</p>
                <p className={pos.unrealizedPnlPercent >= 0 ? "to-mini-pos" : "to-mini-neg"}>
                  {pos.unrealizedPnlPercent >= 0 ? "+" : ""}{pos.unrealizedPnlPercent.toFixed(1)}%
                </p>
                <div className="to-mini-chart" />
              </div>
            ))}
          </div>
        </div>

        <div className="to-card to-card-tx">
          <h2>Transactions</h2>
          <div className="to-tx-actions">
            <button type="button" className="to-btn-sm">↑↓ Sort by</button>
            <button type="button" className="to-btn-sm">Export</button>
          </div>
          <table className="to-table">
            <thead>
              <tr>
                <th>Asset Name</th>
                <th>Type</th>
                <th>Movement</th>
                <th>Status</th>
                <th>Total Value</th>
              </tr>
            </thead>
            <tbody>
              {(transactions.length > 0 ? transactions : recentActivity.map((a, i) => ({
                id: `a-${i}`,
                type: a.type,
                symbol: a.ticker,
                amountCents: a.amountCents,
                quantity: a.quantity,
                priceCents: null,
                status: "Success",
                createdAt: a.date,
              }))).slice(0, 5).map((tx) => (
                <tr key={tx.id}>
                  <td>{tx.symbol || "—"}</td>
                  <td>{tx.type === "buy" ? "Receive" : "Send"}</td>
                  <td className={tx.amountCents >= 0 ? "to-pos" : "to-neg"}>
                    {tx.amountCents >= 0 ? "+" : ""}{formatMoney(tx.amountCents)}
                  </td>
                  <td><span className="to-status to-status--success">{tx.status || "Success"}</span></td>
                  <td>{tx.priceCents != null && tx.quantity != null ? formatMoney(tx.priceCents * tx.quantity) : formatMoney(tx.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="to-card to-card-trending">
          <h2>Trending Assets 🏆</h2>
          <p className="to-trending-pct">+{trendingChange.toFixed(2)}% 24 hr</p>
          <div className="to-trending-chart" />
          <p className="to-trending-name">{trendingTicker ? `${(trendingTicker as { ticker: string; companyName?: string }).companyName || (trendingTicker as { ticker: string }).ticker} (${(trendingTicker as { ticker: string }).ticker})` : "—"}</p>
          <p className="to-trending-cta">Want to invest more?</p>
        </div>
      </div>
    </div>
  );
}
