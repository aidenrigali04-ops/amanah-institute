import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { getStockDetail, getPortfolio, placeBuy, getOHLC } from "../api";
import "./TradingExecution.css";

const symbolFromUrl = (params: URLSearchParams) => params.get("symbol") || "AAPL";

export default function TradingExecution() {
  const [searchParams] = useSearchParams();
  const symbol = symbolFromUrl(searchParams);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getStockDetail>> | null>(null);
  const [portfolio, setPortfolio] = useState<Awaited<ReturnType<typeof getPortfolio>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(10);
  const [price, setPrice] = useState(0);
  const [balancePercent, setBalancePercent] = useState(19);
  const [activeTab, setActiveTab] = useState("Chart");
  const [chartRange, setChartRange] = useState<"1d" | "5d" | "1mo" | "1y">("1d");
  const [ohlcData, setOhlcData] = useState<{ time?: number; date?: string; open: number; high: number; low: number; close: number }[]>([]);

  useEffect(() => {
    Promise.all([getStockDetail(symbol).catch(() => null), getPortfolio().catch(() => null)])
      .then(([d, p]) => {
        setDetail(d || null);
        setPortfolio(p || null);
        if (d?.quote?.price) setPrice(d.quote.price);
      })
      .finally(() => setLoading(false));
  }, [symbol]);

  useEffect(() => {
    const range = chartRange === "1d" ? "5d" : chartRange === "5d" ? "5d" : chartRange === "1mo" ? "1mo" : "1y";
    getOHLC(symbol, "1d", range).then((res: { data?: { time?: number; open: number; high: number; low: number; close: number }[] }) => {
      setOhlcData(res?.data ?? []);
    }).catch(() => setOhlcData([]));
  }, [symbol, chartRange]);

  const quote = detail?.quote ?? { price: 0, currency: "USD", changePercent: 0 };
  const companyName = detail?.companyName ?? symbol;
  const exchange = detail?.exchange ?? "—";
  const cap = detail?.capitalization ?? { marketCap: null, netLiability: null, tev: null, commonEquity: null, totalLiabilities: null, totalCapital: null };
  const cashCents = portfolio?.snapshot?.cashAvailableCents ?? 1000000;
  const balance = cashCents / 100;
  const investmentTotal = price * quantity;
  const fee = 5;

  const orderBookRows = [
    { price: 190.5, amount: 500, total: 95250, side: "ask" as const },
    { price: 190.45, amount: 1200, total: 228540, side: "ask" as const },
    { price: 190.4, amount: 800, total: 152320, side: "ask" as const },
    { price: 190.35, amount: 600, total: 114210, side: "bid" as const },
    { price: 190.3, amount: 1500, total: 285450, side: "bid" as const },
    { price: 190.25, amount: 1500, total: 285375, side: "bid" as const },
    { price: 190.2, amount: 2200, total: 418440, side: "bid" as const },
  ];

  const peers = [
    { ticker: "TSLA", growth: 8.4, change: 1.24 },
    { ticker: "RIVN", growth: 5.2, change: -0.8 },
    { ticker: "NVDA", growth: 12.1, change: 2.5 },
    { ticker: "ABM", growth: 3.0, change: 0.5 },
  ];

  const handleBuy = () => {
    placeBuy(symbol, quantity, Math.round(price * 100)).then(() => setQuantity(0)).catch(console.error);
  };

  if (loading) return <div className="te-page"><div className="te-loading">Loading…</div></div>;

  return (
    <div className="te-page">
      <header className="te-header">
        <div className="te-stock-title">
          <span className="te-logo">🍎</span>
          <span>{symbol} ${quote.price.toFixed(2)}</span>
        </div>
        <nav className="te-tabs">
          {["Chart", "Statistics", "Analyst", "Earnings", "Insider", "Financials", "Peer"].map((tab) => (
            <button key={tab} type="button" className={`te-tab ${activeTab === tab ? "te-tab--active" : ""}`} onClick={() => setActiveTab(tab)}>{tab}</button>
          ))}
        </nav>
        <div className="te-header-right">
          <button type="button" className="te-btn te-btn--outline">Analyze</button>
          <button type="button" className="te-icon">🔖</button>
        </div>
      </header>

      <div className="te-info-bar">
        <span>{exchange} • {companyName}</span>
        <span className="te-price">${quote.price.toFixed(2)}</span>
        <span className={(quote.changePercent ?? 0) >= 0 ? "te-pos" : "te-neg"}>
          {(quote.changePercent ?? 0) >= 0 ? "+" : ""}{(quote.changePercent ?? 0).toFixed(2)}%
        </span>
      </div>

      <div className="te-layout">
        <div className="te-main">
          <div className="te-chart-actions">
            <button type="button" className="te-sell-btn">Sell</button>
            <button type="button" className="te-buy-btn te-buy-btn--active">Buy</button>
          </div>
          <div className="te-chart-area">
            {ohlcData.length > 0 ? (
              <svg viewBox="0 0 400 200" preserveAspectRatio="none" className="te-chart-svg">
                {(() => {
                  const closes = ohlcData.map((d) => d.close);
                  const min = Math.min(...closes);
                  const max = Math.max(...closes);
                  const range = max - min || 1;
                  const w = 400; const h = 200; const pad = 4;
                  const points = closes.map((c, i) => `${(i / (closes.length - 1 || 1)) * (w - pad * 2) + pad},${h - pad - ((c - min) / range) * (h - pad * 2)}`).join(" ");
                  return <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={points} />;
                })()}
              </svg>
            ) : (
              <span className="te-chart-placeholder">Price chart (OHLC)</span>
            )}
          </div>
          <div className="te-chart-footer">
            {(["1d", "5d", "1mo", "1y"] as const).map((r) => (
              <button key={r} type="button" className={chartRange === r ? "te-range" : ""} onClick={() => setChartRange(r)}>{r === "1d" ? "1D" : r === "5d" ? "5D" : r === "1mo" ? "1M" : "1Y"}</button>
            ))}
            <a href="#share" className="te-share">Share chart ↗</a>
          </div>
        </div>

        <aside className="te-buy-panel">
          <h2>Buy Stock <button type="button" className="te-close">×</button></h2>
          <p className="te-balance">Trading Balance: ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          <input type="range" min="0" max="100" value={balancePercent} onChange={(e) => setBalancePercent(Number(e.target.value))} className="te-slider" />
          <p className="te-percent">{balancePercent}%</p>
          <p className="te-investment">Investment Total: ${investmentTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          <div className="te-price-row">
            <span>Buy Price</span>
            <span className="te-price-controls">
              <button type="button" onClick={() => setPrice((p) => Math.max(0, p - 0.01))}>−</button>
              <span>${price.toFixed(2)}</span>
              <button type="button" onClick={() => setPrice((p) => p + 0.01)}>+</button>
            </span>
          </div>
          <div className="te-price-row">
            <span>Quantity</span>
            <span className="te-price-controls">
              <button type="button" onClick={() => setQuantity((q) => Math.max(0, q - 1))}>−</button>
              <span>{quantity}</span>
              <button type="button" onClick={() => setQuantity((q) => q + 1)}>+</button>
            </span>
          </div>
          <p className="te-total">Total: ${(investmentTotal).toFixed(2)}</p>
          <p className="te-fee">Transaction Fee: ${fee}</p>
          <button type="button" className="te-submit" onClick={handleBuy}>Buy {symbol}</button>
          <p className="te-disclaimer">By placing this order, you agree to our <a href="#terms">Terms and Conditions</a>.</p>
        </aside>
      </div>

      <div className="te-bottom">
        <div className="te-orderbook">
          <h3>Order Book <span className="te-chev">›</span></h3>
          <table className="te-ob-table">
            <thead><tr><th>Price</th><th>Amount</th><th>Total</th></tr></thead>
            <tbody>
              {orderBookRows.map((r, i) => (
                <tr key={i} className={r.side === "ask" ? "te-ask" : "te-bid"}>
                  <td>${r.price.toFixed(2)}</td>
                  <td>{r.amount.toLocaleString()}</td>
                  <td>{r.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="te-peers">
          <h3>Peer Analysis <a href="#all">View all</a></h3>
          <ul className="te-peer-list">
            {peers.map((p) => (
              <li key={p.ticker}>
                <span className="te-peer-ticker">{p.ticker}</span>
                <span className="te-peer-growth">Est. revenue growth</span>
                <span className={p.change >= 0 ? "te-pos" : "te-neg"}>{p.change >= 0 ? "+" : ""}{p.change}%</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="te-cap">
          <h3>Capitalization Breakdown</h3>
          <p className="te-cap-currency">Currency in USD</p>
          <ul className="te-cap-list">
            <li>Net Liability: <span className="te-neg">{cap.netLiability != null ? `${(cap.netLiability / 1e9).toFixed(2)}B` : "—"}</span></li>
            <li>Market Cap: <span>{cap.marketCap != null ? `${(cap.marketCap / 1e12).toFixed(2)}T` : "—"}</span></li>
            <li><strong>Total Enterprise Value (TEV):</strong> {cap.tev != null ? `${(cap.tev / 1e12).toFixed(2)}T` : "—"}</li>
            <li>Common Equity: {cap.commonEquity != null ? `${(cap.commonEquity / 1e9).toFixed(2)}B` : "—"}</li>
            <li>Total Liability: {cap.totalLiabilities != null ? `${(cap.totalLiabilities / 1e9).toFixed(2)}B` : "—"}</li>
            <li>Total Capital: {cap.totalCapital != null ? `${(cap.totalCapital / 1e9).toFixed(2)}B` : "—"}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
