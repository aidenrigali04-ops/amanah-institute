import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getPortfolio, getAccounts, getOrders, getWatchlist } from "../api";
import { useProfile } from "../hooks/useProfile";
import "./StocksScreener.css";

const formatMoney = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function StocksScreener() {
  const navigate = useNavigate();
  const { displayName } = useProfile();
  const [portfolio, setPortfolio] = useState<Awaited<ReturnType<typeof getPortfolio>> | null>(null);
  const [, setAccounts] = useState<Awaited<ReturnType<typeof getAccounts>>>([]);
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof getOrders>>>([]);
  const [watchlist, setWatchlist] = useState<{ symbol: string; name?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getPortfolio().catch(() => null),
      getAccounts(),
      getOrders({ limit: 20 }),
      getWatchlist(),
    ]).then(([p, acc, ord, wl]) => {
      setPortfolio(p || null);
      setAccounts(Array.isArray(acc) ? acc : []);
      setOrders(Array.isArray(ord) ? ord : []);
      setWatchlist(Array.isArray(wl) ? wl : (wl as { watchlist?: { symbol: string; name?: string }[] })?.watchlist ?? []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="ss-page"><div className="ss-loading">Loading…</div></div>;

  const snapshot = portfolio?.snapshot ?? { totalAccountValueCents: 0, cashAvailableCents: 0, currency: "USD" };
  const totalCents = snapshot.totalAccountValueCents;
  const cashCents = snapshot.cashAvailableCents ?? 0;
  const pnlPercent = totalCents > 0 ? 2.95 : 0;
  const pnlCents = Math.round(totalCents * (pnlPercent / 100));
  const positions = portfolio?.positions ?? [];
  const withdrawTotal = 9784800;

  const orderRows = orders.slice(0, 5).map((o: { side: string; symbol: string; createdAt?: string; quantity?: number; priceCents?: number; status?: string }) => ({
    action: o.side === "buy" ? `Buy ${o.symbol}` : `Sell ${o.symbol}`,
    date: o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—",
    amount: o.quantity ?? 0,
    price: o.priceCents ? (o.priceCents / 100).toFixed(2) : "—",
    status: o.status === "filled" || o.status === "completed" ? "Success" : "Pending",
  }));

  const followed = watchlist.length > 0 ? watchlist : positions.slice(0, 5).map((p) => ({ symbol: p.ticker, name: p.companyName }));

  return (
    <div className="ss-page">
      <header className="ss-header">
        <div className="ss-search-wrap">
          <span className="ss-search-icon">⌕</span>
          <input type="text" className="ss-search" placeholder="Q Search Stock" />
          <span className="ss-kbd">⌘+K</span>
        </div>
        <div className="ss-user">
          <button type="button" className="ss-icon">🔔</button>
          <div className="ss-avatar">👤</div>
          <div>
            <div className="ss-name">{displayName}</div>
            <div className="ss-sub">Amanah Institute</div>
          </div>
        </div>
      </header>

      <div className="ss-ticker">
        {positions.slice(0, 4).map((p) => (
          <div key={p.ticker} className="ss-ticker-item">
            <span className="ss-ticker-sym">{p.ticker}</span>
            <span>${p.currentPrice.toFixed(2)}</span>
            <span className={p.unrealizedPnlPercent >= 0 ? "ss-pos" : "ss-neg"}>{p.unrealizedPnlPercent >= 0 ? "+" : ""}{p.unrealizedPnlPercent.toFixed(2)}%</span>
          </div>
        ))}
      </div>

      <h1 className="ss-title">Stock Dashboard</h1>
      <p className="ss-subtitle">Real-time stock dashboard with price, volume, trends, and alerts.</p>

      <div className="ss-actions-row">
        <div className="ss-balance-cards">
          <div className="ss-balance-card">
            <h3>Portfolio Balance</h3>
            <p className="ss-balance-value">{(totalCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} USD</p>
            <p className="ss-pos">+{pnlPercent}% <span>+{formatMoney(pnlCents)}</span></p>
          </div>
          <div className="ss-balance-card">
            <h3>Balance Deposit</h3>
            <p className="ss-balance-value">{(cashCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} USD</p>
          </div>
          <div className="ss-balance-card">
            <h3>Total Withdraw</h3>
            <p className="ss-balance-value">${(withdrawTotal / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} USD</p>
          </div>
        </div>
        <div className="ss-top-btns">
          <button type="button" className="ss-btn ss-btn--outline">Deposit</button>
          <button type="button" className="ss-btn ss-btn--dark">Withdraw</button>
        </div>
      </div>

      <div className="ss-two-col">
        <div className="ss-card">
          <h2>Stock Portfolio</h2>
          <p className="ss-card-sub">Overview of your diversified stock portfolio.</p>
          <ul className="ss-stock-list">
            {positions.length > 0 ? positions.map((p) => (
              <li key={p.ticker}>
                <span className="ss-stock-sym">{p.ticker}</span>
                <span>${p.currentPrice.toFixed(2)}</span>
                <span className={p.unrealizedPnlPercent >= 0 ? "ss-pos" : "ss-neg"}>{p.unrealizedPnlPercent >= 0 ? "+" : ""}{p.unrealizedPnlPercent.toFixed(2)}%</span>
              </li>
            )) : (
              <li className="ss-empty">No positions yet. Deposit and buy stocks.</li>
            )}
          </ul>
        </div>
        <div className="ss-card">
          <h2>History Stock Order</h2>
          <p className="ss-card-sub">Track past trades for informed decisions.</p>
          <div className="ss-select-wrap"><select className="ss-select"><option>All</option></select></div>
          <table className="ss-table">
            <thead><tr><th>Action</th><th>Date</th><th>Amount</th><th>Price</th><th>Status</th></tr></thead>
            <tbody>
              {orderRows.length > 0 ? orderRows.map((r: { action: string; date: string; amount: number; price: string; status: string }, i: number) => (
                <tr key={i}><td>{r.action}</td><td>{r.date}</td><td>{r.amount}</td><td>{r.price}</td><td><span className={`ss-status ss-status--${r.status === "Success" ? "green" : "yellow"}`}>{r.status}</span></td></tr>
              )) : (
                <tr><td colSpan={5}>No orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <section className="ss-followed">
        <h2>Followed Stock</h2>
        <p className="ss-card-sub">Monitor popular stocks for strategic investments.</p>
        <div className="ss-followed-nav">‹ ›</div>
        <div className="ss-followed-list">
          {followed.map((f) => (
            <div key={f.symbol} className="ss-followed-card" onClick={() => navigate(`/invest/trade?symbol=${f.symbol}`)}>
              <span className="ss-stock-sym">{f.symbol}</span>
              <span className="ss-pos">+1.63%</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
