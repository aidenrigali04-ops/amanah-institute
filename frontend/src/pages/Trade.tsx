import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createChart, CandlestickData } from "lightweight-charts";
import {
  getQuote,
  getOHLC,
  getSymbols,
  getWatchlist,
  addWatchlist,
  removeWatchlist,
  getHoldings,
  getAccounts,
  placeBuy,
  placeSell,
  getOrders,
} from "../api";

const TIMEFRAMES = [
  { label: "1D", interval: "1d", range: "5d" },
  { label: "5D", interval: "1d", range: "5d" },
  { label: "1M", interval: "1d", range: "1mo" },
  { label: "3M", interval: "1d", range: "3mo" },
  { label: "6M", interval: "1d", range: "6mo" },
  { label: "1Y", interval: "1d", range: "1y" },
];

export default function Trade() {
  const navigate = useNavigate();
  const [symbol, setSymbol] = useState("AAPL");
  const [search, setSearch] = useState("");
  const [symbolSuggestions, setSymbolSuggestions] = useState<{ symbol: string; name: string | null }[]>([]);
  const [timeframeIndex, setTimeframeIndex] = useState(2);
  const [quote, setQuote] = useState<{ price: number; currency: string; changePercent?: number } | null>(null);
  const [ohlcData, setOhlcData] = useState<CandlestickData[]>([]);
  const [watchlist, setWatchlist] = useState<{ symbol: string }[]>([]);
  const [holdings, setHoldings] = useState<{ symbol: string; quantity: number; avgCostCents: number; account?: { type: string } }[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; type: string; name: string | null; balanceCents: number }[]>([]);
  const [halalSymbols, setHalalSymbols] = useState<{ symbol: string; name: string | null }[]>([]);

  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const [orderQty, setOrderQty] = useState("");
  const [orderPrice, setOrderPrice] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [orderError, setOrderError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState("");
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [ordersRefresh, setOrdersRefresh] = useState(0);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

  const tf = TIMEFRAMES[timeframeIndex];
  const interval = tf?.interval ?? "1d";
  const range = tf?.range ?? "1mo";

  const loadQuote = useCallback(async (sym: string) => {
    const q = await getQuote(sym);
    setQuote(q);
    return q?.price;
  }, []);

  const loadOHLC = useCallback(async (sym: string) => {
    const res = await getOHLC(sym, interval, range);
    const data: CandlestickData[] = (res.data || []).map((d: { time: number; open: number; high: number; low: number; close: number }) => ({
      time: d.time as unknown as string,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    setOhlcData(data);
  }, [interval, range]);

  useEffect(() => {
    loadQuote(symbol);
  }, [symbol, loadQuote]);

  useEffect(() => {
    loadOHLC(symbol);
  }, [symbol, loadOHLC]);

  useEffect(() => {
    getWatchlist().then(setWatchlist);
    getAccounts().then((a) => {
      setAccounts(a);
      const sd = a.find((x: { type: string }) => x.type === "self_directed");
      if (sd && !selectedAccountId) setSelectedAccountId(sd.id);
    });
    getHoldings().then(setHoldings);
    getSymbols().then(setHalalSymbols);
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current || ohlcData.length === 0) return;
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "#0d1117" },
        textColor: "#8b949e",
        fontFamily: "Outfit, system-ui, sans-serif",
      },
      grid: { vertLines: { color: "#21262d" }, horzLines: { color: "#21262d" } },
      rightPriceScale: { borderColor: "#30363d", scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: { borderColor: "#30363d", timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { labelBackgroundColor: "#58a6ff" }, horzLine: { labelBackgroundColor: "#58a6ff" } },
    });
    const candlestick = chart.addCandlestickSeries({
      upColor: "#3fb950",
      downColor: "#f85149",
      borderDownColor: "#f85149",
      borderUpColor: "#3fb950",
      wickDownColor: "#f85149",
      wickUpColor: "#3fb950",
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
    if (quote?.price != null) setOrderPrice(String(Math.round(quote.price * 100)));
  }, [quote?.price]);

  const handleSearchChange = (v: string) => {
    setSearch(v.toUpperCase());
    if (v.length < 1) setSymbolSuggestions([]);
    else setSymbolSuggestions(halalSymbols.filter((s) => s.symbol.startsWith(v.toUpperCase())).slice(0, 8));
  };

  const handleSelectSymbol = (sym: string) => {
    setSymbol(sym);
    setSearch(sym);
    setSymbolSuggestions([]);
  };

  const handleAddWatchlist = async (sym: string) => {
    try {
      await addWatchlist(sym);
      setWatchlist((w) => (w.some((x) => x.symbol === sym) ? w : [...w, { symbol: sym }]));
    } catch {}
  };

  const handleRemoveWatchlist = (sym: string) => {
    removeWatchlist(sym).then(() => setWatchlist((w) => w.filter((x) => x.symbol !== sym)));
  };

  const handlePlaceOrder = async () => {
    const qty = parseFloat(orderQty);
    const priceCents = Math.round(parseFloat(orderPrice || "0"));
    if (!(qty > 0 && priceCents > 0)) {
      setOrderError("Enter quantity and price.");
      return;
    }
    setOrderError("");
    setOrderSuccess("");
    setLoadingOrder(true);
    try {
      if (orderSide === "buy") {
        await placeBuy(symbol, qty, priceCents, selectedAccountId || undefined);
        setOrderSuccess("Buy order filled.");
      } else {
        await placeSell(symbol, qty, priceCents, selectedAccountId || undefined);
        setOrderSuccess("Sell order filled.");
      }
      setOrderQty("");
      setOrdersRefresh((c) => c + 1);
      loadQuote(symbol);
      getHoldings().then(setHoldings);
    } catch (e) {
      setOrderError(e instanceof Error ? e.message : "Order failed");
    } finally {
      setLoadingOrder(false);
    }
  };

  const selfDirectedAccount = accounts.find((a) => a.type === "self_directed");
  const balanceCents = selfDirectedAccount?.balanceCents ?? 0;

  return (
    <div className="app">
      <header className="topbar">
        <input
          type="text"
          className="symbol-search"
          placeholder="Symbol (e.g. AAPL)"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => search && setSymbolSuggestions(halalSymbols.filter((s) => s.symbol.startsWith(search.toUpperCase())).slice(0, 8))}
        />
        {symbolSuggestions.length > 0 && (
          <div className="symbol-dropdown">
            {symbolSuggestions.map((s) => (
              <div key={s.symbol} className="symbol-dropdown-item" onClick={() => handleSelectSymbol(s.symbol)}>
                <span className="sym">{s.symbol}</span>
                {s.name && <span className="name">{s.name}</span>}
              </div>
            ))}
          </div>
        )}
        <div className="timeframes">
          {TIMEFRAMES.map((t, i) => (
            <button key={t.label} className={`timeframe-btn ${i === timeframeIndex ? "active" : ""}`} onClick={() => setTimeframeIndex(i)}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span className="topbar-balance">Balance: ${(balanceCents / 100).toFixed(2)}</span>
          <button className="btn-logout" onClick={() => { localStorage.removeItem("amanah_token"); navigate("/login", { replace: true }); }}>
            Log out
          </button>
        </div>
      </header>

      <aside className="sidebar-left">
        <div className="section-title">Watchlist</div>
        {watchlist.map((w) => (
          <div
            key={w.symbol}
            className={`watchlist-item ${w.symbol === symbol ? "active" : ""}`}
            onClick={() => handleSelectSymbol(w.symbol)}
          >
            <span>{w.symbol}</span>
            <button
              type="button"
              className="watchlist-remove"
              onClick={(e) => { e.stopPropagation(); handleRemoveWatchlist(w.symbol); }}
              aria-label="Remove"
            >
              ×
            </button>
          </div>
        ))}
        <div className="section-title">Add to watchlist</div>
        {halalSymbols.slice(0, 12).map((s) => (
          <div key={s.symbol} className="watchlist-item">
            <span onClick={() => handleSelectSymbol(s.symbol)}>{s.symbol}</span>
            {watchlist.some((x) => x.symbol === s.symbol) ? (
              <button type="button" className="watchlist-remove" onClick={() => handleRemoveWatchlist(s.symbol)}>×</button>
            ) : (
              <button type="button" className="watchlist-add" onClick={() => handleAddWatchlist(s.symbol)}>+</button>
            )}
          </div>
        ))}
      </aside>

      <main className="chart-area">
        <div className="quote-header">
          <span className="symbol">{symbol}</span>
          <span className={`price ${quote?.changePercent != null ? (quote.changePercent >= 0 ? "up" : "down") : ""}`}>
            {quote != null ? `$${quote.price.toFixed(2)}` : "—"}
          </span>
          {quote?.changePercent != null && (
            <span className={`change ${quote.changePercent >= 0 ? "up" : "down"}`}>
              {quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%
            </span>
          )}
        </div>
        <div className="chart-container" ref={chartContainerRef} />
      </main>

      <aside className="panel-right">
        <div className="quote-header" style={{ borderBottom: "1px solid var(--border)", padding: "12px 16px" }}>
          <span className="symbol">{symbol}</span>
          <span className={`price ${quote?.changePercent != null ? (quote.changePercent >= 0 ? "up" : "down") : ""}`}>
            {quote != null ? `$${quote.price.toFixed(2)}` : "—"}
          </span>
        </div>
        <div className="order-form">
          <div className="row">
            <label>Side</label>
            <select value={orderSide} onChange={(e) => setOrderSide(e.target.value as "buy" | "sell")}>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>
          <div className="row">
            <label>Account</label>
            <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}>
              {accounts.filter((a) => a.type === "self_directed").map((a) => (
                <option key={a.id} value={a.id}>{a.name || a.type} (${(a.balanceCents / 100).toFixed(2)})</option>
              ))}
            </select>
          </div>
          <div className="row">
            <label>Quantity</label>
            <input
              type="number"
              min="0"
              step="0.000001"
              placeholder="0"
              value={orderQty}
              onChange={(e) => setOrderQty(e.target.value)}
            />
          </div>
          <div className="row">
            <label>Price ($) – market uses last price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={orderPrice ? (Number(orderPrice) / 100).toFixed(2) : ""}
              onChange={(e) => setOrderPrice(String(Math.round(parseFloat(e.target.value || "0") * 100)))}
            />
          </div>
          {orderError && <p className="error-msg">{orderError}</p>}
          {orderSuccess && <p className="success-msg">{orderSuccess}</p>}
          <button
            className={orderSide === "buy" ? "btn-buy" : "btn-sell"}
            onClick={handlePlaceOrder}
            disabled={loadingOrder}
          >
            {loadingOrder ? "Placing…" : orderSide === "buy" ? "Buy" : "Sell"} {symbol}
          </button>
        </div>
        <div className="section-title">Positions (self-directed)</div>
        <table className="pos-table">
          <thead>
            <tr><th>Symbol</th><th>Qty</th><th>Avg cost</th></tr>
          </thead>
          <tbody>
            {holdings.filter((h) => h.account?.type === "self_directed" || !h.account).map((h) => (
              <tr key={`${h.symbol}-${h.account?.type}`}>
                <td><button type="button" className="link-symbol" onClick={() => handleSelectSymbol(h.symbol)}>{h.symbol}</button></td>
                <td>{Number(h.quantity).toFixed(4)}</td>
                <td>${(h.avgCostCents / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </aside>

      <div className="bottom-panel">
        <div className="section-title">Recent orders</div>
        <OrdersTable onSelectSymbol={handleSelectSymbol} refresh={ordersRefresh} />
      </div>
    </div>
  );
}

function OrdersTable({ onSelectSymbol, refresh }: { onSelectSymbol: (s: string) => void; refresh?: number }) {
  const [orders, setOrders] = useState<{ id: string; symbol: string; side: string; executionQuantity: number; executionPriceCents: number; status: string; createdAt: string }[]>([]);
  useEffect(() => {
    getOrders(20).then(setOrders);
  }, [refresh]);
  return (
    <table className="pos-table">
      <thead>
        <tr><th>Time</th><th>Symbol</th><th>Side</th><th>Qty</th><th>Price</th><th>Status</th></tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id}>
            <td>{new Date(o.createdAt).toLocaleString()}</td>
            <td><button type="button" className="link-symbol" onClick={() => onSelectSymbol(o.symbol)}>{o.symbol}</button></td>
            <td className={o.side === "buy" ? "up" : "down"}>{o.side}</td>
            <td>{o.executionQuantity?.toFixed(4) ?? "—"}</td>
            <td>${((o.executionPriceCents ?? 0) / 100).toFixed(2)}</td>
            <td>{o.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
