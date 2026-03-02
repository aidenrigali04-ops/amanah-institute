import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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

const TABS = ["Chart", "Statistics", "Analyst", "Earnings", "Insider", "Financials", "Peer"] as const;

const TRANSACTION_FEE_USD = 5;

function formatNum(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toLocaleString();
}

type DetailShape = Awaited<ReturnType<typeof getStockDetail>> & {
  capitalization?: {
    marketCap: number | null;
    netLiability: number | null;
    tev: number | null;
    commonEquity: number | null;
    totalLiabilities: number | null;
    totalCapital: number | null;
  };
};

function emptyDetail(symbol: string): DetailShape {
  return {
    symbol,
    quote: { price: 0, currency: "USD", changePercent: 0, previousClose: 0 },
    companyName: symbol,
    exchange: "—",
    complianceBadge: "Under Review",
    marketSnapshot: {
      marketCap: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      averageVolume: null,
      beta: null,
      trailingPE: null,
      revenueGrowthPercent: null,
      rsiLabel: "Neutral",
      volumeTrend: "Stable",
      earningsTrend: "Flat",
    },
    sentimentScore: { bullishPercent: 33, neutralPercent: 34, bearishPercent: 33 },
    sentimentShift: null,
    topHeadlines: [],
    shariaCompliance: {
      compliant: false,
      lastScreeningDate: null,
      complianceSafetyScore: "Not screened",
      debtRatioPercent: null,
      haramRevenuePercent: null,
      nearThresholdWarning: false,
    },
    capitalization: {
      marketCap: null,
      netLiability: null,
      tev: null,
      commonEquity: null,
      totalLiabilities: null,
      totalCapital: null,
    },
  };
}

/** Placeholder order book rows around current price */
function placeholderOrderBook(price: number): { price: number; amount: number; side: "bid" | "ask" }[] {
  const rows: { price: number; amount: number; side: "bid" | "ask" }[] = [];
  const step = 0.05;
  for (let i = 4; i >= 1; i--) {
    rows.push({ price: Math.round((price + step * i) * 100) / 100, amount: 500 + i * 700, side: "ask" });
  }
  for (let i = 1; i <= 4; i++) {
    rows.push({ price: Math.round((price - step * i) * 100) / 100, amount: 1000 + i * 500, side: "bid" });
  }
  return rows;
}

const PLACEHOLDER_PEERS = [
  { symbol: "TSLA", name: "Tesla", revenueGrowth: 8.4, change: 1.24 },
  { symbol: "RIVN", name: "Rivian", revenueGrowth: 12.3, change: 2.15 },
  { symbol: "NVDA", name: "NVIDIA", revenueGrowth: 4.15, change: 0.85 },
  { symbol: "ABM", name: "ABM Industries", revenueGrowth: 6.75, change: 0.95 },
];

type StockDetailProps = { defaultTicker?: string };

export default function StockDetail({ defaultTicker = "AAPL" }: StockDetailProps) {
  const { ticker: paramTicker } = useParams<{ ticker?: string }>();
  const navigate = useNavigate();
  const symbol = (paramTicker ?? defaultTicker ?? "AAPL").toUpperCase();
  const [detail, setDetail] = useState<DetailShape | null>(null);
  const [ohlcData, setOhlcData] = useState<CandlestickData[]>([]);
  const [tfIndex, setTfIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Chart");
  const [watchlist, setWatchlist] = useState<{ symbol: string }[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; type: string; name: string | null; balanceCents: number }[]>([]);
  const [portfolioValueCents, setPortfolioValueCents] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [balancePercent, setBalancePercent] = useState(19);

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
    setDataError(null);
    getStockDetail(symbol)
      .then((d) => {
        setDetail({ ...d, capitalization: (d as DetailShape).capitalization ?? emptyDetail(symbol).capitalization });
      })
      .catch((e) => {
        setDetail(emptyDetail(symbol));
        setDataError(e instanceof Error ? e.message : "Could not load live data. Showing placeholder.");
      })
      .finally(() => setLoading(false));
  }, [symbol]);

  const loadOhlc = useCallback(async () => {
    if (!symbol) return;
    try {
      const res = await getOHLC(symbol, interval, range);
      const raw = res.data || [];
      const data: CandlestickData[] = raw.map((d: { time: number; open: number; high: number; low: number; close: number }) => ({
        time: Number(d.time) as import("lightweight-charts").UTCTimestamp,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));
      setOhlcData(data);
    } catch {
      setOhlcData([]);
    }
  }, [symbol, interval, range]);

  useEffect(() => {
    loadOhlc();
  }, [loadOhlc]);

  const price = detail?.quote?.price ?? 0;
  const previousClose = detail?.quote?.previousClose ?? price;
  const fallbackCandles = useMemo((): CandlestickData[] => {
    if (price <= 0) return [];
    const now = new Date();
    const today = Math.floor(now.getTime() / 1000);
    const yesterday = today - 86400;
    const prev = previousClose && previousClose !== price ? previousClose : price * 0.998;
    return [
      { time: yesterday as import("lightweight-charts").UTCTimestamp, open: prev, high: prev, low: prev, close: prev },
      { time: today as import("lightweight-charts").UTCTimestamp, open: prev, high: Math.max(price, prev), low: Math.min(price, prev), close: price },
    ];
  }, [price, previousClose]);

  const chartData = ohlcData.length > 0 ? ohlcData : fallbackCandles;

  useEffect(() => {
    if (!chartContainerRef.current || chartData.length === 0) return;
    const container = chartContainerRef.current;
    const chart = createChart(container, {
      layout: {
        background: { color: "#ffffff" },
        textColor: "#333",
        fontFamily: "system-ui, sans-serif",
      },
      grid: { vertLines: { color: "#eee" }, horzLines: { color: "#eee" } },
      rightPriceScale: { borderColor: "#e0e0e0", scaleMargins: { top: 0.1, bottom: 0.25 } },
      timeScale: { borderColor: "#e0e0e0" },
      crosshair: { vertLine: { labelBackgroundColor: "#2e7d32" }, horzLine: { labelBackgroundColor: "#2e7d32" } },
      width: container.clientWidth,
      height: 380,
    });
    const candlestick = chart.addCandlestickSeries({
      upColor: "#2e7d32",
      downColor: "#c62828",
      borderDownColor: "#c62828",
      borderUpColor: "#2e7d32",
      wickDownColor: "#c62828",
      wickUpColor: "#2e7d32",
    });
    candlestick.setData(chartData);
    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (chartRef.current && container.parentElement) {
        chartRef.current.applyOptions({ width: container.clientWidth });
      }
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [chartData]);

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
        <p className="stock-detail-error">No symbol selected. <Link to="/invest">Go to My Account</Link> or <Link to="/invest/trade">Market</Link>.</p>
      </div>
    );
  }

  if (loading && !detail) {
    return (
      <div className="stock-detail">
        <div className="stock-detail-loading">Loading stock data…</div>
      </div>
    );
  }

  if (!detail) return null;

  const changePercent = detail.quote.changePercent ?? 0;
  const changePositive = changePercent >= 0;
  const cap = detail.capitalization ?? emptyDetail(symbol).capitalization!;
  const orderBookRows = placeholderOrderBook(price);
  const investmentTotalFromSlider = Math.round((balanceCents / 100) * (balancePercent / 100) * 100) / 100;
  const buyPrice = orderType === "market" ? price : (parseFloat(limitPrice || "0") || price);
  const qtyNum = inputMode === "shares" ? parseFloat(quantity || "0") : price > 0 ? (parseFloat(dollarAmount || "0") / price) : 0;
  const totalFromOrder = Math.round(qtyNum * buyPrice * 100) / 100;

  return (
    <div className="stock-detail">
      {dataError && (
        <div className="stock-data-error" role="alert">
          {dataError}
        </div>
      )}

      {/* 1. Stock Identity Header + Tabs */}
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
        <nav className="stock-tabs" aria-label="Data views">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`stock-tab-btn ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>
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

      {/* Sell / Buy toggle above chart */}
      <div className="stock-actions-row">
        <button type="button" className={`stock-action-btn ${orderSide === "sell" ? "active" : ""}`} onClick={() => setOrderSide("sell")}>Sell</button>
        <button type="button" className={`stock-action-btn ${orderSide === "buy" ? "active" : ""}`} onClick={() => setOrderSide("buy")}>Buy</button>
      </div>

      {/* 2. Chart (TradingView-style) */}
      <section className="stock-chart-section">
        <div className="stock-chart-toolbar">
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
          <span className="stock-chart-hint">TradingView Lightweight Charts</span>
        </div>
        <div className="stock-chart-container" ref={chartContainerRef}>
          {chartData.length === 0 && !loading && <div className="stock-chart-empty">No chart data</div>}
        </div>
      </section>

      {/* Main grid: Order Book + Buy card | Panels */}
      <div className="stock-main-grid">
        <div className="stock-main-left">
          <section className="stock-panel stock-order-book">
            <h2 className="stock-panel-title">Order Book</h2>
            <div className="stock-order-book-table-wrap">
              <table className="stock-order-book-table">
                <thead>
                  <tr><th>Price</th><th>Amount</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {orderBookRows.map((row, i) => (
                    <tr key={i} className={row.side === "ask" ? "ask" : "bid"}>
                      <td>${row.price.toFixed(2)}</td>
                      <td>{row.amount.toLocaleString()}</td>
                      <td>{(row.price * row.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="stock-panel stock-peer">
            <h2 className="stock-panel-title">Peer Analysis <Link to="/invest/trade" className="stock-link">View all</Link></h2>
            <ul className="stock-peer-list">
              {PLACEHOLDER_PEERS.map((p) => (
                <li key={p.symbol}>
                  <span className="stock-peer-symbol">{p.symbol}</span>
                  <span className="stock-peer-meta">Est. revenue growth ··· +{p.revenueGrowth}%</span>
                  <span className="stock-peer-change positive">+{p.change}%</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="stock-main-right">
          {/* Buy Stock card – balance slider, +/- price & qty, fee */}
          <section className="stock-order-card">
            <h2 className="stock-panel-title">{orderSide === "buy" ? "Buy" : "Sell"} Stock</h2>
            <div className="stock-order-row">
              <label>Trading balance</label>
              <span>${(balanceCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="stock-order-row">
              <label>Allocation</label>
              <div className="stock-slider-row">
                <input type="range" min="0" max="100" value={balancePercent} onChange={(e) => setBalancePercent(Number(e.target.value))} className="stock-balance-slider" />
                <span>{balancePercent}%</span>
              </div>
            </div>
            <div className="stock-order-row">
              <label>Investment Total</label>
              <span>${investmentTotalFromSlider.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="stock-order-row">
              <label>Buy Price ($)</label>
              <div className="stock-stepper">
                <button type="button" className="stock-stepper-btn" disabled={orderType === "market"} onClick={() => limitPrice && parseFloat(limitPrice) > 0.01 && setLimitPrice((parseFloat(limitPrice) - 0.01).toFixed(2))} aria-label="Decrease">−</button>
                <input type="number" min="0" step="0.01" value={orderType === "market" ? price.toFixed(2) : (limitPrice || price.toFixed(2))} onChange={(e) => orderType === "limit" && setLimitPrice(e.target.value)} readOnly={orderType === "market"} className="stock-stepper-input" />
                <button type="button" className="stock-stepper-btn" disabled={orderType === "market"} onClick={() => setLimitPrice((buyPrice + 0.01).toFixed(2))} aria-label="Increase">+</button>
              </div>
            </div>
            <div className="stock-order-row">
              <label>Quantity</label>
              <div className="stock-qty-mode">
                <button type="button" className={inputMode === "shares" ? "active" : ""} onClick={() => setInputMode("shares")}>Shares</button>
                <button type="button" className={inputMode === "dollars" ? "active" : ""} onClick={() => setInputMode("dollars")}>$ Amount</button>
              </div>
              <div className="stock-stepper">
                <button type="button" className="stock-stepper-btn" onClick={() => qtyNum >= 1 && (inputMode === "shares" ? setQuantity(String(Math.floor(qtyNum - 1))) : setDollarAmount((Math.max(0, (qtyNum - 1) * buyPrice)).toFixed(2)))} aria-label="Decrease">−</button>
                <input type="number" min="0" step={inputMode === "shares" ? 1 : 0.01} value={inputMode === "shares" ? quantity : dollarAmount} onChange={(e) => inputMode === "shares" ? setQuantity(e.target.value) : setDollarAmount(e.target.value)} className="stock-stepper-input" />
                <button type="button" className="stock-stepper-btn" onClick={() => inputMode === "shares" ? setQuantity(String(Math.floor(qtyNum + 1))) : setDollarAmount(((qtyNum + 1) * buyPrice).toFixed(2))} aria-label="Increase">+</button>
              </div>
            </div>
            <div className="stock-order-row">
              <label>Total</label>
              <span>${totalFromOrder.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="stock-order-row">
              <label>Transaction Fee</label>
              <span>${TRANSACTION_FEE_USD.toFixed(2)}</span>
            </div>
            <div className="stock-order-row">
              <label>Order type</label>
              <select value={orderType} onChange={(e) => setOrderType(e.target.value as "market" | "limit")}>
                <option value="market">Market</option>
                <option value="limit">Limit</option>
              </select>
            </div>
            <div className="stock-order-row">
              <label>Account</label>
              <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}>
                {accounts.filter((a) => a.type === "self_directed").map((a) => (
                  <option key={a.id} value={a.id}>{a.name || "Personal"}</option>
                ))}
              </select>
            </div>

            <div className="stock-risk">
              <p>Position after trade: {portfolioValueCents > 0 ? positionPercentAfter.toFixed(1) : "0"}% of portfolio</p>
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
          </section>

          <section className="stock-panel stock-capitalization">
            <h2 className="stock-panel-title">Capitalization Breakdown</h2>
            <p className="stock-panel-sub">Currency in USD</p>
            <dl className="stock-dl">
              <div><dt>Net Liability</dt><dd>{cap?.netLiability != null ? formatNum(cap.netLiability) : "—"}</dd></div>
              <div><dt>Market Cap</dt><dd>{formatNum(cap?.marketCap ?? null)}</dd></div>
              <div><dt>Total Enterprise Value (TEV)</dt><dd>{cap?.tev != null ? formatNum(cap.tev) : "—"}</dd></div>
              <div><dt>Common Equity</dt><dd>{formatNum(cap?.commonEquity ?? null)}</dd></div>
              <div><dt>Total Liability</dt><dd>{formatNum(cap?.totalLiabilities ?? null)}</dd></div>
              <div><dt>Total Capital</dt><dd>{formatNum(cap?.totalCapital ?? null)}</dd></div>
            </dl>
          </section>
        </div>
      </div>

      {/* Tab content: Statistics / Analyst etc. (below main grid) */}
      {activeTab !== "Chart" && (
        <div className="stock-panels">
          {activeTab === "Statistics" && (
            <section className="stock-panel stock-snapshot">
              <h2 className="stock-panel-title">Market Snapshot</h2>
              <dl className="stock-dl">
                <div><dt>Market Cap</dt><dd>{formatNum(detail.marketSnapshot.marketCap)}</dd></div>
                <div><dt>52W High / Low</dt><dd>{detail.marketSnapshot.fiftyTwoWeekHigh != null ? `$${detail.marketSnapshot.fiftyTwoWeekHigh.toFixed(2)}` : "—"} / {detail.marketSnapshot.fiftyTwoWeekLow != null ? `$${detail.marketSnapshot.fiftyTwoWeekLow.toFixed(2)}` : "—"}</dd></div>
                <div><dt>Avg Volume</dt><dd>{formatNum(detail.marketSnapshot.averageVolume)}</dd></div>
                <div><dt>Beta</dt><dd>{detail.marketSnapshot.beta != null ? detail.marketSnapshot.beta.toFixed(2) : "—"}</dd></div>
                <div><dt>P/E</dt><dd>{detail.marketSnapshot.trailingPE != null ? detail.marketSnapshot.trailingPE.toFixed(2) : "—"}</dd></div>
                <div><dt>Revenue growth</dt><dd>{detail.marketSnapshot.revenueGrowthPercent != null ? `${detail.marketSnapshot.revenueGrowthPercent}%` : "—"}</dd></div>
              </dl>
            </section>
          )}
          {(activeTab === "Analyst" || activeTab === "Earnings" || activeTab === "Insider" || activeTab === "Financials") && (
            <section className="stock-panel">
              <h2 className="stock-panel-title">{activeTab}</h2>
              <p className="stock-panel-sub">Content coming soon.</p>
            </section>
          )}
          {activeTab === "Peer" && (
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
          )}
        </div>
      )}

      {/* Sharia panel when Chart tab */}
      {activeTab === "Chart" && (
        <div className="stock-panels">
          <section className="stock-panel stock-snapshot">
            <h2 className="stock-panel-title">Market Snapshot</h2>
            <dl className="stock-dl">
              <div><dt>Market Cap</dt><dd>{formatNum(detail.marketSnapshot.marketCap)}</dd></div>
              <div><dt>52W High / Low</dt><dd>{detail.marketSnapshot.fiftyTwoWeekHigh != null ? `$${detail.marketSnapshot.fiftyTwoWeekHigh.toFixed(2)}` : "—"} / {detail.marketSnapshot.fiftyTwoWeekLow != null ? `$${detail.marketSnapshot.fiftyTwoWeekLow.toFixed(2)}` : "—"}</dd></div>
              <div><dt>Avg Volume</dt><dd>{formatNum(detail.marketSnapshot.averageVolume)}</dd></div>
              <div><dt>Beta</dt><dd>{detail.marketSnapshot.beta != null ? detail.marketSnapshot.beta.toFixed(2) : "—"}</dd></div>
              <div><dt>RSI</dt><dd>{detail.marketSnapshot.rsiLabel}</dd></div>
              <div><dt>P/E</dt><dd>{detail.marketSnapshot.trailingPE != null ? detail.marketSnapshot.trailingPE.toFixed(2) : "—"}</dd></div>
            </dl>
          </section>
          <section className="stock-panel stock-sharia">
            <h2 className="stock-panel-title">Sharia Compliance</h2>
            <dl className="stock-dl">
              <div><dt>Last screening</dt><dd>{detail.shariaCompliance.lastScreeningDate ? new Date(detail.shariaCompliance.lastScreeningDate).toLocaleDateString() : "—"}</dd></div>
              <div><dt>Safety score</dt><dd className={detail.shariaCompliance.nearThresholdWarning ? "warn" : ""}>{detail.shariaCompliance.complianceSafetyScore}</dd></div>
            </dl>
            {!detail.shariaCompliance.compliant && (
              <p className="stock-sharia-warn">Buy is disabled for symbols not meeting halal screening.</p>
            )}
          </section>
        </div>
      )}

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
