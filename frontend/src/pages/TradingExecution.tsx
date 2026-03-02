import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createChart, CandlestickData } from "lightweight-charts";
import {
  getInstruments,
  getStockDetail,
  getOHLC,
  getOrders,
  getWatchlist,
  getQuote,
  getDashboardFeed,
} from "../api";
import "./TradingExecution.css";

const CHART_TIMEFRAMES = [
  { label: "1D", range: "5d" },
  { label: "1W", range: "5d" },
  { label: "1M", range: "1mo" },
  { label: "1Y", range: "1y" },
  { label: "5Y", range: "5y" },
  { label: "All", range: "5y" },
];

const MAIN_TABS = ["Overview", "Options", "Financials", "Analysis", "Company", "News", "Comments"] as const;

type DetailShape = Awaited<ReturnType<typeof getStockDetail>>;

export default function TradingExecution() {
  const navigate = useNavigate();
  const [instruments, setInstruments] = useState<{ symbol: string; name: string; assetType: string; price: number; changePercent: number }[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("AAPL");
  const [detail, setDetail] = useState<DetailShape | null>(null);
  const [ohlcData, setOhlcData] = useState<CandlestickData[]>([]);
  const [tfIndex, setTfIndex] = useState(0);
  const [mainTab, setMainTab] = useState<(typeof MAIN_TABS)[number]>("Overview");
  const [orderBookTab, setOrderBookTab] = useState<"open" | "closed">("closed");
  const [orders, setOrders] = useState<{ id: string; symbol: string; side: string; quantity: number; limitPriceCents: number | null; status: string; executionPriceCents: number | null; executionQuantity: number | null }[]>([]);
  const [watchlist, setWatchlist] = useState<{ symbol: string }[]>([]);
  const [watchlistQuotes, setWatchlistQuotes] = useState<Record<string, { price: number; changePercent: number }>>({});
  const [news, setNews] = useState<{ title: string; publishedAt?: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [orderLtp, setOrderLtp] = useState<Record<string, number>>({});
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const tf = CHART_TIMEFRAMES[tfIndex];
  const range = tf?.range ?? "1mo";
  const interval = "1d";

  useEffect(() => {
    getInstruments(60).then(setInstruments).catch(() => setInstruments([]));
  }, []);

  useEffect(() => {
    if (!selectedSymbol) return;
    getStockDetail(selectedSymbol).then(setDetail).catch(() => setDetail(null));
  }, [selectedSymbol]);

  const loadOhlc = useCallback(() => {
    if (!selectedSymbol) return;
    getOHLC(selectedSymbol, interval, range).then((res) => {
      const raw = res.data || [];
      const data: CandlestickData[] = raw.map((d: { time: number; open: number; high: number; low: number; close: number }) => ({
        time: Number(d.time) as import("lightweight-charts").UTCTimestamp,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));
      setOhlcData(data);
    }).catch(() => setOhlcData([]));
  }, [selectedSymbol, interval, range]);

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
      layout: { background: { color: "#ffffff" }, textColor: "#333", fontFamily: "system-ui, sans-serif" },
      grid: { vertLines: { color: "#eee" }, horzLines: { color: "#eee" } },
      rightPriceScale: { borderColor: "#e0e0e0", scaleMargins: { top: 0.1, bottom: 0.25 } },
      timeScale: { borderColor: "#e0e0e0" },
      crosshair: { vertLine: { labelBackgroundColor: "#2e7d32" }, horzLine: { labelBackgroundColor: "#2e7d32" } },
      width: container.clientWidth,
      height: Math.max(300, container.clientHeight || 300),
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
    const ro = new ResizeObserver(() => {
      if (chartRef.current && container.parentElement) chartRef.current.applyOptions({ width: container.clientWidth });
    });
    ro.observe(container);
    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [chartData]);

  useEffect(() => {
    const status = orderBookTab === "open" ? "open" : "closed";
    getOrders({ limit: 50, status }).then(setOrders).catch(() => setOrders([]));
  }, [orderBookTab]);

  useEffect(() => {
    const symbols = [...new Set(orders.map((o) => o.symbol))];
    if (symbols.length === 0) {
      setOrderLtp({});
      return;
    }
    Promise.all(symbols.map((s) => getQuote(s).then((q) => ({ sym: s, price: q?.price ?? 0 })))).then((pairs) => {
      setOrderLtp(Object.fromEntries(pairs.map((p) => [p.sym, p.price])));
    });
  }, [orders]);

  useEffect(() => {
    getWatchlist().then(setWatchlist).catch(() => setWatchlist([]));
  }, []);

  useEffect(() => {
    if (watchlist.length === 0) {
      setWatchlistQuotes({});
      return;
    }
    const syms = watchlist.map((w) => w.symbol);
    Promise.all(syms.map((s) => getQuote(s).then((q) => ({ sym: s, price: q?.price ?? 0, change: q?.changePercent ?? 0 })))).then((arr) => {
      setWatchlistQuotes(Object.fromEntries(arr.map((a) => [a.sym, { price: a.price, changePercent: a.change }])));
    });
  }, [watchlist]);

  useEffect(() => {
    if (detail?.topHeadlines?.length) {
      setNews(detail.topHeadlines.map((h) => ({ title: h.title, publishedAt: h.publishedAt })));
    } else {
      getDashboardFeed({ limit: 20 })
        .then((r) => {
          const items = (r as { allItems?: { title?: string; publishedAt?: string }[] }).allItems ?? [];
          setNews(items.slice(0, 8).map((i) => ({ title: i.title ?? "", publishedAt: i.publishedAt })));
        })
        .catch(() => setNews([]));
    }
  }, [detail?.symbol, detail?.topHeadlines]);

  const filteredInstruments = useMemo(() => {
    if (!searchQuery.trim()) return instruments;
    const q = searchQuery.toUpperCase();
    return instruments.filter((i) => i.symbol.toUpperCase().includes(q) || (i.name || "").toUpperCase().includes(q));
  }, [instruments, searchQuery]);

  const tradingTime = useMemo(() => {
    const d = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `Trading ${months[d.getMonth()]} ${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")} ET`;
  }, []);

  const formatOrderStatus = (s: string) => (s === "completed" ? "Complete" : s === "pending" ? "Pending" : "Cancelled");

  return (
    <div className="trading-execution">
      {/* Top bar */}
      <header className="trading-topbar">
        <Link to="/dashboard" className="trading-topbar-logo">Amanah</Link>
        <input
          type="search"
          className="trading-topbar-search"
          placeholder="Search for stocks, F&amp;O, indices etc."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search instruments"
        />
        <span className="trading-topbar-instrument">EQ</span>
        <span className="trading-topbar-timeframe">5m</span>
        <button type="button" className="trading-topbar-instant" onClick={() => navigate(`/invest/stock/${selectedSymbol}`)}>
          Instant Order
        </button>
        <div className="trading-topbar-icons">
          <button type="button" className="trading-topbar-icon" onClick={loadOhlc} aria-label="Refresh">↻</button>
          <Link to="/profile" className="trading-topbar-icon" aria-label="Settings">⚙</Link>
          <button type="button" className="trading-topbar-icon" aria-label="Full screen">⛶</button>
        </div>
        <nav className="trading-topbar-nav">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/invest" className="active">Orders</Link>
          <Link to="/invest">Holdings</Link>
          <Link to="/invest">Positions</Link>
          <Link to="/invest">Funds</Link>
        </nav>
        <div className="trading-topbar-user">
          <span>Account</span>
          <span aria-hidden>▾</span>
        </div>
      </header>

      <div className="trading-body">
        {/* Left sidebar – scrollable instruments */}
        <aside className="trading-left">
          <div className="trading-left-title">Instruments</div>
          <div className="trading-left-list">
            {filteredInstruments.map((inst) => (
              <div
                key={inst.symbol}
                className={`trading-instrument ${selectedSymbol === inst.symbol ? "active" : ""}`}
                onClick={() => setSelectedSymbol(inst.symbol)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setSelectedSymbol(inst.symbol)}
              >
                <span className="trading-instrument-name">{inst.symbol} {inst.assetType}</span>
                <div className="trading-instrument-meta">
                  <span className="trading-instrument-price">{inst.price > 0 ? inst.price.toFixed(2) : "—"}</span>
                  <span className={`trading-instrument-change ${inst.changePercent >= 0 ? "positive" : "negative"}`}>
                    {inst.changePercent >= 0 ? "+" : ""}{inst.changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
            {filteredInstruments.length === 0 && <div className="trading-empty">No instruments</div>}
          </div>
        </aside>

        {/* Center – main, non-scrollable */}
        <main className="trading-center">
          {/* Stock header */}
          <section className="trading-stock-header">
            <span className="trading-stock-name">{detail?.companyName ?? selectedSymbol} {detail?.exchange ? `· ${detail.exchange}` : ""}</span>
            <span className="trading-stock-price">${price.toFixed(2)}</span>
            <span className={`trading-stock-change ${(detail?.quote?.changePercent ?? 0) >= 0 ? "positive" : "negative"}`}>
              {(detail?.quote?.changePercent ?? 0) >= 0 ? "↑ +" : "↓ "}{(detail?.quote?.changePercent ?? 0).toFixed(2)}%
            </span>
            <span className="trading-stock-time">{tradingTime}</span>
            <div className="trading-stock-metrics">
              <span>Market Cap: {detail?.marketSnapshot?.marketCap != null ? (detail.marketSnapshot.marketCap >= 1e12 ? (detail.marketSnapshot.marketCap / 1e12).toFixed(2) + "T" : (detail.marketSnapshot.marketCap / 1e9).toFixed(2) + "B") : "—"}</span>
              <span>P/E (TTM): {detail?.marketSnapshot?.trailingPE != null ? detail.marketSnapshot.trailingPE.toFixed(2) : "—"}</span>
            </div>
            <button type="button" className="trading-compare">+ Compare</button>
          </section>

          {/* Tabs */}
          <div className="trading-tabs">
            {MAIN_TABS.map((tab) => (
              <button key={tab} type="button" className={`trading-tab ${mainTab === tab ? "active" : ""}`} onClick={() => setMainTab(tab)}>{tab}</button>
            ))}
          </div>

          {/* Chart */}
          <div className="trading-chart-wrap">
            <div className="trading-chart-toolbar">
              <select className="trading-chart-hours" aria-label="Trading hours">
                <option>Full Hours</option>
              </select>
              <div className="trading-chart-timeframes">
                {CHART_TIMEFRAMES.map((t, i) => (
                  <button key={t.label} type="button" className={`trading-chart-tf ${i === tfIndex ? "active" : ""}`} onClick={() => setTfIndex(i)}>{t.label}</button>
                ))}
              </div>
            </div>
            <div className="trading-chart-container" ref={chartContainerRef} />
          </div>

          {/* Order book */}
          <section className="trading-orderbook">
            <div className="trading-orderbook-header">
              <span className="trading-orderbook-title">Order Book ({orders.length})</span>
              <div className="trading-orderbook-toggles">
                <button type="button" className={`trading-orderbook-toggle ${orderBookTab === "open" ? "active" : ""}`} onClick={() => setOrderBookTab("open")}>Open</button>
                <button type="button" className={`trading-orderbook-toggle ${orderBookTab === "closed" ? "active" : ""}`} onClick={() => setOrderBookTab("closed")}>Closed</button>
              </div>
              <div className="trading-orderbook-actions">
                <button type="button" className="trading-topbar-icon" aria-label="Live Alert">🔔</button>
              </div>
            </div>
            <div className="trading-orderbook-table-wrap">
              <table className="trading-orderbook-table">
                <thead>
                  <tr>
                    <th>SYMBOL</th>
                    <th>STATUS</th>
                    <th>SIDE</th>
                    <th>QTY</th>
                    <th>LTP</th>
                    <th>PRICE</th>
                    <th>TRIGGER PRICE</th>
                    <th>AVG PRICE</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.symbol}</td>
                      <td>{formatOrderStatus(o.status)}</td>
                      <td className={o.side === "buy" ? "buy" : "sell"}>{o.side.toUpperCase()}</td>
                      <td>{o.quantity}</td>
                      <td>{(orderLtp[o.symbol] ?? 0).toFixed(2)}</td>
                      <td>{o.limitPriceCents != null ? (o.limitPriceCents / 100).toFixed(2) : "0.00"}</td>
                      <td>0.00</td>
                      <td>{o.executionPriceCents != null ? (o.executionPriceCents / 100).toFixed(2) : "0.00"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orders.length === 0 && <div className="trading-empty">No orders</div>}
            </div>
            <div className="trading-orderbook-buttons">
              <button type="button" className="trading-orderbook-btn buy" onClick={() => navigate(`/invest/stock/${selectedSymbol}`)}>Buy {price.toFixed(2)}</button>
              <button type="button" className="trading-orderbook-btn sell" onClick={() => navigate(`/invest/stock/${selectedSymbol}`)}>Sell {price.toFixed(2)}</button>
            </div>
          </section>
        </main>

        {/* Right sidebar – watchlist + news */}
        <aside className="trading-right">
          <div className="trading-watchlist">
            <div className="trading-panel-title">
              Watchlist
              <button type="button" className="trading-add-now" onClick={() => navigate("/invest/trade")}>+ Add Now</button>
            </div>
            <div className="trading-watchlist-list">
              {watchlist.map((w) => {
                const q = watchlistQuotes[w.symbol];
                return (
                  <div key={w.symbol} className="trading-watchlist-row" onClick={() => setSelectedSymbol(w.symbol)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setSelectedSymbol(w.symbol)}>
                    <span className="trading-watchlist-symbol">{w.symbol}</span>
                    <span className="trading-watchlist-price">
                      {q ? `${q.price.toFixed(2)} (${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%)` : "—"}
                    </span>
                  </div>
                );
              })}
              {watchlist.length === 0 && <div className="trading-empty">Add symbols from Market</div>}
            </div>
          </div>
          <div className="trading-news">
            <div className="trading-news-tabs">
              <button type="button" className="trading-news-tab">Top News</button>
              <button type="button" className="trading-news-tab active">Latest News</button>
            </div>
            <div className="trading-news-list">
              {news.map((item, i) => (
                <div key={i} className="trading-news-item">
                  <h4>{item.title}</h4>
                  {item.publishedAt && <time>{new Date(item.publishedAt).toLocaleString()}</time>}
                </div>
              ))}
              {news.length === 0 && <div className="trading-empty">No news</div>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
