import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { createChart, CandlestickData } from "lightweight-charts";
import {
  getStockDetail,
  getOHLC,
  getWatchlist,
  addWatchlist,
  removeWatchlist,
  getAccounts,
  getPortfolio,
  placeBuy,
  placeSell,
} from "../api";
import "./StockDetail.css";

const TIMEFRAMES = [
  { label: "1D", interval: "1d", range: "5d" },
  { label: "5D", interval: "1d", range: "5d" },
  { label: "1M", interval: "1d", range: "1mo" },
  { label: "3M", interval: "1d", range: "3mo" },
  { label: "6M", interval: "1d", range: "6mo" },
  { label: "1Y", interval: "1d", range: "1y" },
  { label: "5Y", interval: "1d", range: "5y" },
];

function formatNum(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toLocaleString();
}

export default function StockDetail() {
  const { ticker } = useParams<{ ticker: string }>();
  const navigate = useNavigate();
  const symbol = (ticker ?? "").toUpperCase();
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getStockDetail>> | null>(null);
  const [ohlcData, setOhlcData] = useState<CandlestickData[]>([]);
  const [tfIndex, setTfIndex] = useState(0);
  const [watchlist, setWatchlist] = useState<{ symbol: string }[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; type: string; name: string | null; balanceCents: number }[]>([]);
  const [portfolioValueCents, setPortfolioValueCents] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [inputMode, setInputMode] = useState<"shares" | "dollars">("shares");
  const [quantity, setQuantity] = useState("");
  const [dollarAmount, setDollarAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [complianceChecked, setComplianceChecked] = useState(false);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const tf = TIMEFRAMES[tfIndex];
  const interval = tf?.interval ?? "1d";
  const range = tf?.range ?? "1mo";

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    getStockDetail(symbol)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [symbol]);

  const loadOhlc = useCallback(async () => {
    if (!symbol) return;
    const res = await getOHLC(symbol, interval, range);
    const data: CandlestickData[] = (res.data || []).map((d: { time: number; open: number; high: number; low: number; close: number }) => ({
      time: d.time as unknown as string,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    setOhlcData(data);
  }, [symbol, interval, range]);

  useEffect(() => {
    loadOhlc();
  }, [loadOhlc]);

  useEffect(() => {
    if (!chartContainerRef.current || ohlcData.length === 0) return;
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "#ffffff" },
        textColor: "#333",
        fontFamily: "system-ui, sans-serif",
      },
      grid: { vertLines: { color: "#eee" }, horzLines: { color: "#eee" } },
      rightPriceScale: { borderColor: "#e0e0e0", scaleMargins: { top: 0.1, bottom: 0.25 } },
      timeScale: { borderColor: "#e0e0e0" },
      crosshair: { vertLine: { labelBackgroundColor: "#2e7d32" }, horzLine: { labelBackgroundColor: "#2e7d32" } },
    });
    const candlestick = chart.addCandlestickSeries({
      upColor: "#2e7d32",
      downColor: "#c62828",
      borderDownColor: "#c62828",
      borderUpColor: "#2e7d32",
      wickDownColor: "#c62828",
      wickUpColor: "#2e7d32",
    });
    candlestick.setData(ohlcData);
    chart.timeScale().fitContent();
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [ohlcData]);

  useEffect(() => {
    getWatchlist().then(setWatchlist);
    getAccounts().then((a) => {
      setAccounts(a);
      const sd = a.find((x: { type: string }) => x.type === "self_directed");
      if (sd) setSelectedAccountId(sd.id);
    });
    getPortfolio().then((p) => setPortfolioValueCents(p.snapshot.totalAccountValueCents)).catch(() => {});
  }, []);

  const onWatchlist = symbol ? watchlist.some((w) => w.symbol === symbol) : false;
  const toggleWatchlist = async () => {
    if (!symbol) return;
    try {
      if (onWatchlist) await removeWatchlist(symbol);
      else await addWatchlist(symbol);
      setWatchlist((w) => (onWatchlist ? w.filter((x) => x.symbol !== symbol) : [...w, { symbol }]));
    } catch {}
  };

  const price = detail?.quote?.price ?? 0;
  const selfDirected = accounts.find((a) => a.type === "self_directed");
  const balanceCents = selfDirected?.balanceCents ?? 0;
  const qtyFromInput = inputMode === "shares" ? parseFloat(quantity || "0") : price > 0 ? parseFloat(dollarAmount || "0") / price : 0;
  const execPriceCents = orderType === "market" ? Math.round(price * 100) : Math.round(parseFloat(limitPrice || "0") * 100);
  const totalCents = Math.round(qtyFromInput * (execPriceCents / 100));
  const positionPercentAfter = portfolioValueCents > 0 ? (totalCents / portfolioValueCents) * 100 : 0;
  const largestPositionWarning = positionPercentAfter > 35;
  const canConfirm = complianceChecked && qtyFromInput > 0 && execPriceCents > 0 && (orderSide === "sell" || totalCents <= balanceCents) && detail?.shariaCompliance?.compliant !== false;

  const openOrderSummary = () => {
    if (!canConfirm) return;
    setShowOrderSummary(true);
  };

  const submitOrder = async () => {
    if (!symbol || !canConfirm) return;
    setSubmitting(true);
    setOrderError("");
    setOrderSuccess("");
    try {
      if (orderSide === "buy") {
        await placeBuy(symbol, qtyFromInput, execPriceCents, selectedAccountId || undefined);
        setOrderSuccess("Buy order filled.");
      } else {
        await placeSell(symbol, qtyFromInput, execPriceCents, selectedAccountId || undefined);
        setOrderSuccess("Sell order filled.");
      }
      setShowOrderSummary(false);
      setQuantity("");
      setDollarAmount("");
      setLimitPrice("");
      setComplianceChecked(false);
      getStockDetail(symbol).then(setDetail);
      getPortfolio().then((p) => setPortfolioValueCents(p.snapshot.totalAccountValueCents));
    } catch (e) {
      setOrderError(e instanceof Error ? e.message : "Order failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!symbol) {
    return (
      <div className="stock-detail">
        <p className="stock-detail-error">Missing symbol.</p>
      </div>
    );
  }

  if (loading || error) {
    return (
      <div className="stock-detail">
        <div className="stock-detail-loading">{loading ? "Loading…" : error}</div>
      </div>
    );
  }

  if (!detail) return null;

  const changePercent = detail.quote.changePercent ?? 0;
  const changePositive = changePercent >= 0;

  return (
    <div className="stock-detail">
      {/* 1. Stock Identity Header */}
      <header className="stock-header">
        <button type="button" className="stock-back" onClick={() => navigate("/invest")} aria-label="Back">
          ←
        </button>
        <div className="stock-identity">
          <h1 className="stock-name">{detail.companyName}</h1>
          <p className="stock-meta">{detail.exchange} · {detail.symbol}</p>
          <div className="stock-price-row">
            <span className="stock-price">${detail.quote.price.toFixed(2)}</span>
            <span className={`stock-change ${changePositive ? "positive" : "negative"}`}>
              {changePositive ? "+" : ""}{changePercent.toFixed(2)}%
            </span>
          </div>
        </div>
        <span className="stock-badge">{detail.complianceBadge}</span>
        <button
          type="button"
          className={`stock-watchlist ${onWatchlist ? "on" : ""}`}
          onClick={toggleWatchlist}
          aria-label={onWatchlist ? "Remove from watchlist" : "Add to watchlist"}
          title={onWatchlist ? "Remove from watchlist" : "Add to watchlist"}
        >
          ★
        </button>
      </header>

      {/* 2. Chart */}
      <section className="stock-chart-section">
        <div className="stock-chart-toggles">
          {TIMEFRAMES.map((t, i) => (
            <button
              key={t.label}
              type="button"
              className={`stock-tf-btn ${i === tfIndex ? "active" : ""}`}
              onClick={() => setTfIndex(i)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="stock-chart-container" ref={chartContainerRef} />
      </section>

      {/* 3. Market Snapshot + 4. Sentiment + 5. Sharia (grid below chart) */}
      <div className="stock-panels">
        <section className="stock-panel stock-snapshot">
          <h2 className="stock-panel-title">Market Snapshot</h2>
          <dl className="stock-dl">
            <div><dt>Market Cap</dt><dd>{formatNum(detail.marketSnapshot.marketCap)}</dd></div>
            <div><dt>52W High / Low</dt><dd>{detail.marketSnapshot.fiftyTwoWeekHigh != null ? `$${detail.marketSnapshot.fiftyTwoWeekHigh.toFixed(2)}` : "—"} / {detail.marketSnapshot.fiftyTwoWeekLow != null ? `$${detail.marketSnapshot.fiftyTwoWeekLow.toFixed(2)}` : "—"}</dd></div>
            <div><dt>Avg Volume</dt><dd>{formatNum(detail.marketSnapshot.averageVolume)}</dd></div>
            <div><dt>Beta</dt><dd>{detail.marketSnapshot.beta != null ? detail.marketSnapshot.beta.toFixed(2) : "—"}</dd></div>
            <div><dt>RSI</dt><dd>{detail.marketSnapshot.rsiLabel}</dd></div>
            <div><dt>Volume trend</dt><dd>{detail.marketSnapshot.volumeTrend}</dd></div>
            <div><dt>P/E</dt><dd>{detail.marketSnapshot.trailingPE != null ? detail.marketSnapshot.trailingPE.toFixed(2) : "—"}</dd></div>
            <div><dt>Revenue growth</dt><dd>{detail.marketSnapshot.revenueGrowthPercent != null ? `${detail.marketSnapshot.revenueGrowthPercent}%` : "—"}</dd></div>
            <div><dt>Earnings trend</dt><dd>{detail.marketSnapshot.earningsTrend}</dd></div>
          </dl>
        </section>

        <section className="stock-panel stock-sentiment">
          <h2 className="stock-panel-title">Sentiment & News</h2>
          <div className="stock-sentiment-bars">
            <span className="sentiment positive">Bullish {detail.sentimentScore.bullishPercent}%</span>
            <span className="sentiment neutral">Neutral {detail.sentimentScore.neutralPercent}%</span>
            <span className="sentiment negative">Bearish {detail.sentimentScore.bearishPercent}%</span>
          </div>
          <ul className="stock-headlines">
            {detail.topHeadlines.map((h, i) => (
              <li key={i} className={`headline headline-${h.sentiment}`}>
                <span className="headline-label">{h.sentiment}</span>
                {h.title}
              </li>
            ))}
          </ul>
          <Link to={`/dashboard/feed`} className="stock-link">Full News View</Link>
        </section>

        <section className="stock-panel stock-sharia">
          <h2 className="stock-panel-title">Sharia Compliance</h2>
          <dl className="stock-dl">
            <div><dt>Debt ratio</dt><dd>{detail.shariaCompliance.debtRatioPercent != null ? `${detail.shariaCompliance.debtRatioPercent}%` : "—"}</dd></div>
            <div><dt>Haram revenue</dt><dd>{detail.shariaCompliance.haramRevenuePercent != null ? `${detail.shariaCompliance.haramRevenuePercent}%` : "—"}</dd></div>
            <div><dt>Last screening</dt><dd>{detail.shariaCompliance.lastScreeningDate ? new Date(detail.shariaCompliance.lastScreeningDate).toLocaleDateString() : "—"}</dd></div>
            <div><dt>Safety score</dt><dd className={detail.shariaCompliance.nearThresholdWarning ? "warn" : ""}>{detail.shariaCompliance.complianceSafetyScore}</dd></div>
          </dl>
          {!detail.shariaCompliance.compliant && (
            <p className="stock-sharia-warn">Buy is disabled for symbols not meeting halal screening.</p>
          )}
        </section>
      </div>

      {/* 6. Order Panel + 7. Risk + 8. Summary modal */}
      <section className="stock-order-section">
        <div className="stock-order-card">
          <h2 className="stock-panel-title">{orderSide === "buy" ? "Buy" : "Sell"} Stock</h2>
          <div className="stock-order-row">
            <label>Trading balance</label>
            <span>${(balanceCents / 100).toFixed(2)}</span>
          </div>
          <div className="stock-order-tabs">
            <button type="button" className={orderSide === "buy" ? "active" : ""} onClick={() => setOrderSide("buy")}>Buy</button>
            <button type="button" className={orderSide === "sell" ? "active" : ""} onClick={() => setOrderSide("sell")}>Sell</button>
          </div>
          <div className="stock-order-row">
            <label>Account</label>
            <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}>
              {accounts.filter((a) => a.type === "self_directed").map((a) => (
                <option key={a.id} value={a.id}>{a.name || "Personal"} (${(a.balanceCents / 100).toFixed(2)})</option>
              ))}
            </select>
          </div>
          <div className="stock-order-row">
            <label>Order type</label>
            <select value={orderType} onChange={(e) => setOrderType(e.target.value as "market" | "limit")}>
              <option value="market">Market</option>
              <option value="limit">Limit</option>
            </select>
          </div>
          {orderType === "limit" && (
            <div className="stock-order-row">
              <label>Limit price ($)</label>
              <input type="number" min="0" step="0.01" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder="0.00" />
            </div>
          )}
          <div className="stock-order-row">
            <label>Quantity</label>
            <div className="stock-qty-mode">
              <button type="button" className={inputMode === "shares" ? "active" : ""} onClick={() => setInputMode("shares")}>Shares</button>
              <button type="button" className={inputMode === "dollars" ? "active" : ""} onClick={() => setInputMode("dollars")}>$ Amount</button>
            </div>
            {inputMode === "shares" ? (
              <input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
            ) : (
              <input type="number" min="0" step="0.01" value={dollarAmount} onChange={(e) => setDollarAmount(e.target.value)} placeholder="0.00" />
            )}
          </div>
          <div className="stock-order-row">
            <label>Estimated total</label>
            <span>${(totalCents / 100).toFixed(2)}</span>
          </div>
          {orderSide === "buy" && (
            <div className="stock-order-row">
              <label>Cash after trade</label>
              <span>${((balanceCents - totalCents) / 100).toFixed(2)}</span>
            </div>
          )}

          {/* Risk confirmation */}
          <div className="stock-risk">
            <p>Position size after trade: {portfolioValueCents > 0 ? (positionPercentAfter.toFixed(1)) : "0"}% of portfolio</p>
            {largestPositionWarning && <p className="stock-risk-warn">Largest position warning (&gt;35%)</p>}
            <label className="stock-compliance-check">
              <input type="checkbox" checked={complianceChecked} onChange={(e) => setComplianceChecked(e.target.checked)} />
              I understand this stock meets halal screening criteria.
            </label>
          </div>

          {orderError && <p className="stock-order-err">{orderError}</p>}
          {orderSuccess && <p className="stock-order-ok">{orderSuccess}</p>}

          <button
            type="button"
            className={`stock-order-btn ${orderSide}`}
            onClick={openOrderSummary}
            disabled={!canConfirm || (detail.shariaCompliance.compliant === false && orderSide === "buy")}
          >
            {orderSide === "buy" ? "Buy" : "Sell"} {detail.symbol}
          </button>
          <p className="stock-terms">By placing this order, you agree to our <a href="#terms">Terms and Conditions</a>.</p>
        </div>
      </section>

      {/* Order Summary Modal */}
      {showOrderSummary && (
        <div className="stock-modal-overlay" onClick={() => !submitting && setShowOrderSummary(false)}>
          <div className="stock-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Order Summary</h3>
            <dl className="stock-dl">
              <div><dt>Side</dt><dd>{orderSide === "buy" ? "Buy" : "Sell"}</dd></div>
              <div><dt>Quantity</dt><dd>{qtyFromInput.toLocaleString()}</dd></div>
              <div><dt>Est. price</dt><dd>${(execPriceCents / 100).toFixed(2)}</dd></div>
              <div><dt>Total</dt><dd>${(totalCents / 100).toFixed(2)}</dd></div>
              <div><dt>Cash after</dt><dd>${((balanceCents - (orderSide === "buy" ? totalCents : -totalCents)) / 100).toFixed(2)}</dd></div>
              <div><dt>Portfolio allocation</dt><dd>{portfolioValueCents > 0 ? (positionPercentAfter.toFixed(1)) : "0"}%</dd></div>
            </dl>
            <div className="stock-modal-actions">
              <button type="button" className="stock-modal-cancel" onClick={() => !submitting && setShowOrderSummary(false)}>Cancel</button>
              <button type="button" className="stock-order-btn buy" onClick={submitOrder} disabled={submitting}>
                {submitting ? "Placing…" : "Confirm Trade"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
