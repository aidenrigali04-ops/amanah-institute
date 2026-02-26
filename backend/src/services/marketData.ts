/**
 * Market data for charts and order execution (Yahoo Finance).
 */

import YahooFinance from "yahoo-finance2";

let yahoo: InstanceType<typeof YahooFinance> | null = null;
function getYahoo(): InstanceType<typeof YahooFinance> {
  if (!yahoo) yahoo = new YahooFinance();
  return yahoo;
}

export interface OHLCBar {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export async function getQuote(symbol: string): Promise<{ price: number; currency: string; previousClose?: number; changePercent?: number } | null> {
  try {
    const Y = getYahoo();
    const quote = await Y.quote(symbol);
    if (!quote || (quote as { regularMarketPrice?: number }).regularMarketPrice == null) return null;
    const q = quote as { regularMarketPrice: number; currency?: string; regularMarketPreviousClose?: number };
    const previousClose = q.regularMarketPreviousClose ?? q.regularMarketPrice;
    const changePercent = previousClose ? ((q.regularMarketPrice - previousClose) / previousClose) * 100 : undefined;
    return {
      price: q.regularMarketPrice,
      currency: q.currency ?? "USD",
      previousClose,
      changePercent,
    };
  } catch {
    return null;
  }
}

export async function getOHLC(
  symbol: string,
  interval: "1d" | "1wk" | "1mo" = "1d",
  range: string = "1mo"
): Promise<OHLCBar[]> {
  try {
    const Y = getYahoo();
    const end = new Date();
    const start = new Date();
    if (range === "5d") start.setDate(start.getDate() - 5);
    else if (range === "1mo") start.setMonth(start.getMonth() - 1);
    else if (range === "3mo") start.setMonth(start.getMonth() - 3);
    else if (range === "6mo") start.setMonth(start.getMonth() - 6);
    else if (range === "1y") start.setFullYear(start.getFullYear() - 1);
    else start.setMonth(start.getMonth() - 1);

    const result = await Y.historical(symbol, { period1: start, period2: end, interval, events: "history" });
    if (!Array.isArray(result) || result.length === 0) return [];
    return result
      .filter((q: { open?: number; close?: number }) => q.open != null && q.close != null)
      .map((q: { date: Date; open: number; high: number; low: number; close: number; volume?: number }) => ({
        time: Math.floor(new Date(q.date).getTime() / 1000),
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume,
      }));
  } catch {
    return [];
  }
}

/** Batch quotes for multiple symbols. Returns map of symbol -> quote or null. */
export async function getQuotes(
  symbols: string[]
): Promise<Record<string, { price: number; currency: string; previousClose?: number; changePercent?: number } | null>> {
  if (symbols.length === 0) return {};
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];
  try {
    const Y = getYahoo();
    const results = await Y.quote(unique);
    const arr = Array.isArray(results) ? results : results ? [results] : [];
    const out: Record<string, { price: number; currency: string; previousClose?: number; changePercent?: number } | null> = {};
    for (const sym of unique) out[sym] = null;
    for (const quote of arr) {
      const q = quote as { symbol?: string; regularMarketPrice?: number; currency?: string; regularMarketPreviousClose?: number };
      const sym = q.symbol?.toUpperCase();
      if (!sym || q.regularMarketPrice == null) continue;
      const previousClose = q.regularMarketPreviousClose ?? q.regularMarketPrice;
      const changePercent = previousClose ? ((q.regularMarketPrice - previousClose) / previousClose) * 100 : undefined;
      out[sym] = {
        price: q.regularMarketPrice,
        currency: q.currency ?? "USD",
        previousClose,
        changePercent,
      };
    }
    return out;
  } catch {
    return Object.fromEntries(unique.map((s) => [s, null]));
  }
}

/** Search symbols via Yahoo. Returns array of { symbol, shortname, quoteType, exchange }. */
export async function searchSymbols(
  query: string,
  limit: number = 20
): Promise<{ symbol: string; shortname: string; quoteType?: string; exchange?: string }[]> {
  if (!query.trim()) return [];
  try {
    const Y = getYahoo();
    const result = await Y.search(query.trim(), { quotesCount: limit });
    const quotes = (result as { quotes?: { symbol?: string; shortname?: string; quoteType?: string; exchange?: string }[] })?.quotes;
    if (!Array.isArray(quotes)) return [];
    return quotes
      .filter((q): q is { symbol: string; shortname?: string; quoteType?: string; exchange?: string } => !!q.symbol)
      .map((q) => ({
        symbol: q.symbol,
        shortname: q.shortname ?? q.symbol,
        quoteType: q.quoteType,
        exchange: q.exchange,
      }));
  } catch {
    return [];
  }
}

/** Day gainers via Yahoo screener. Optional filter to only include symbols in halalSet. */
export interface TopGainerRow {
  symbol: string;
  shortName?: string;
  price: number;
  changePercent: number;
  change?: number;
  previousClose?: number;
  currency: string;
}

export async function getTopGainersDay(
  count: number = 20,
  halalSet?: Set<string>
): Promise<TopGainerRow[]> {
  try {
    const Y = getYahoo();
    const result = await Y.screener({ scrIds: "day_gainers", count: Math.max(count, 50) });
    const quotes = (result as { quotes?: { symbol?: string; shortName?: string; regularMarketPrice?: number; regularMarketChangePercent?: number; regularMarketChange?: number; regularMarketPreviousClose?: number; currency?: string }[] })?.quotes ?? [];
    let rows: TopGainerRow[] = quotes
      .filter((q): q is { symbol: string; shortName?: string; regularMarketPrice: number; regularMarketChangePercent: number; regularMarketChange?: number; regularMarketPreviousClose?: number; currency?: string } =>
        !!q.symbol && typeof (q as { regularMarketPrice?: number }).regularMarketPrice === "number" && typeof (q as { regularMarketChangePercent?: number }).regularMarketChangePercent === "number"
      )
      .map((q) => ({
        symbol: q.symbol,
        shortName: q.shortName,
        price: q.regularMarketPrice,
        changePercent: q.regularMarketChangePercent,
        change: q.regularMarketChange,
        previousClose: q.regularMarketPreviousClose,
        currency: q.currency ?? "USD",
      }));
    if (halalSet && halalSet.size > 0) {
      const upper = (s: string) => s.toUpperCase();
      rows = rows.filter((r) => halalSet.has(upper(r.symbol)));
    }
    return rows.slice(0, count);
  } catch {
    return [];
  }
}

/** Company news/updates from Yahoo Finance insights: press-style headlines (sigDevs), SEC filings, analyst reports */
export interface CompanyNewsItem {
  id: string;
  symbol: string;
  title: string;
  summary?: string;
  publishedAt: string; // ISO
  source: string;      // e.g. "Significant Development", "SEC Filing", "Argus Research"
  type: "sigdev" | "sec" | "report";
  url?: string;
  sentiment: "neutral" | "positive" | "negative";
  formType?: string;  // 10-K, 8-K, etc. for SEC
}

export async function getCompanyInsights(symbol: string): Promise<CompanyNewsItem[]> {
  const items: CompanyNewsItem[] = [];
  try {
    const Y = getYahoo();
    const data = await Y.insights(symbol) as unknown as {
      symbol?: string;
      sigDevs?: { headline?: string; date?: string | Date }[];
      secReports?: { id?: string; title?: string; description?: string; filingDate?: string; formType?: string }[];
      reports?: { reportTitle?: string; title?: string; provider?: string; reportDate?: string | Date; headHtml?: string; investmentRating?: string }[];
    };
    const sym = (data?.symbol ?? symbol).toUpperCase();

    if (Array.isArray(data?.sigDevs)) {
      for (const s of data.sigDevs) {
        if (s?.headline) {
          const dateVal = s.date;
          const publishedAt = dateVal instanceof Date ? dateVal.toISOString() : (dateVal ? new Date(dateVal).toISOString() : new Date().toISOString());
          items.push({
            id: `sigdev-${sym}-${String(dateVal ?? Date.now())}`,
            symbol: sym,
            title: s.headline,
            publishedAt,
            source: "Significant Development",
            type: "sigdev",
            sentiment: "neutral",
          });
        }
      }
    }

    if (Array.isArray(data?.secReports)) {
      for (const r of data.secReports.slice(0, 15)) {
        const title = r?.title ?? r?.description ?? "SEC Filing";
        const date = r?.filingDate ? new Date(r.filingDate).toISOString() : new Date().toISOString();
        items.push({
          id: `sec-${r?.id ?? Math.random().toString(36).slice(2)}`,
          symbol: sym,
          title,
          summary: r?.description ?? undefined,
          publishedAt: date,
          source: "SEC Filing",
          type: "sec",
          formType: r?.formType,
          sentiment: "neutral",
        });
      }
    }

    if (Array.isArray(data?.reports)) {
      for (const r of data.reports.slice(0, 10)) {
        const title = r?.reportTitle ?? r?.title ?? (r as { headHtml?: string }).headHtml?.slice(0, 100) ?? "Research Report";
        const rating = (r as { investmentRating?: string }).investmentRating?.toLowerCase();
        let sentiment: "neutral" | "positive" | "negative" = "neutral";
        if (rating?.includes("bull") || rating?.includes("buy")) sentiment = "positive";
        else if (rating?.includes("bear") || rating?.includes("sell")) sentiment = "negative";
        const reportDate = r?.reportDate;
        const publishedAt = reportDate instanceof Date ? reportDate.toISOString() : (reportDate ? new Date(reportDate).toISOString() : new Date().toISOString());
        items.push({
          id: `report-${sym}-${String(reportDate ?? Date.now())}`,
          symbol: sym,
          title: title.length > 200 ? title.slice(0, 197) + "..." : title,
          summary: undefined,
          publishedAt,
          source: r?.provider ?? "Research",
          type: "report",
          sentiment,
        });
      }
    }

    items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    return items.slice(0, 25);
  } catch {
    return [];
  }
}

/** Batch company insights for multiple symbols (e.g. watchlist). Limits to first 5 symbols to avoid rate limits. */
export async function getCompanyInsightsBatch(
  symbols: string[],
  maxSymbols: number = 5
): Promise<Record<string, CompanyNewsItem[]>> {
  const out: Record<string, CompanyNewsItem[]> = {};
  const limited = symbols.slice(0, maxSymbols);
  for (const sym of limited) {
    out[sym] = await getCompanyInsights(sym);
  }
  return out;
}
