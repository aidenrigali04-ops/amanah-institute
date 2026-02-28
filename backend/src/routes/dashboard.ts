import { Router, Request, Response } from "express";
import { query } from "express-validator";
import { validationResult } from "express-validator";
import { authMiddleware } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { getQuotes, getCompanyInsightsBatch, getTopGainersDay, getTopGainers3d } from "../services/marketData.js";

const router = Router();
router.use(authMiddleware);

/** GET /dashboard – Net worth, accounts, recent activity, next action, market feed preview, top gainers (period=1h|1d|3d|1wk|1mo), chat updates, academy topic, tools, workspace */
router.get(
  "/",
  query("topGainersPeriod").optional().isIn(["1h", "1d", "3d", "1wk", "1mo"]),
  async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const userId = req.user.userId;
  const topGainersPeriod = (req.query.topGainersPeriod as "1h" | "1d" | "3d" | "1wk" | "1mo") ?? "1d";

  const [
    user,
    accounts,
    recentTransactions,
    academyProgress,
    holdings,
    watchlist,
    halalSymbols,
    feedItems,
    academyTopics,
    toolReleases,
    workspace,
    communityPosts,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingPath: true },
    }),
    prisma.account.findMany({
      where: { userId },
      select: { id: true, type: true, name: true, balanceCents: true, currency: true },
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        amountCents: true,
        status: true,
        createdAt: true,
        symbol: true,
      },
    }),
    prisma.academyProgress.findMany({
      where: { userId },
      include: { lesson: { select: { id: true, title: true, slug: true, module: { select: { slug: true, title: true } } } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.portfolioHolding.findMany({
      where: { userId },
      select: { symbol: true, quantity: true, avgCostCents: true },
    }),
    prisma.watchlistItem.findMany({ where: { userId }, select: { symbol: true } }),
    prisma.halalSymbol.findMany({ select: { symbol: true } }),
    prisma.marketFeedItem.findMany({
      orderBy: { publishedAt: "desc" },
      take: 15,
      select: { id: true, symbol: true, title: true, summary: true, sentiment: true, url: true, publishedAt: true },
    }),
    prisma.academyTopic.findMany({
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: { id: true, title: true, summary: true, path: true, link: true, publishedAt: true },
    }),
    prisma.toolRelease.findMany({
      orderBy: { releasedAt: "desc" },
      take: 5,
      select: { id: true, name: true, description: true, category: true, url: true, releasedAt: true },
    }),
    prisma.workspace.findUnique({
      where: { userId },
      select: { id: true, companyName: true, _count: { select: { projects: true } } },
    }),
    prisma.communityPost.findMany({
      where: { status: "visible" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
        channel: { select: { id: true, slug: true, name: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  const path = user?.onboardingPath ?? "both";
  const pathFilter = (p: string) => p === "both" || p === path;
  const latestTopic = academyTopics.find((t) => pathFilter(t.path)) ?? academyTopics[0] ?? null;

  const watchlistSymbols = watchlist.map((w) => w.symbol);
  const halalSet = new Set(halalSymbols.map((h) => h.symbol.toUpperCase()));

  type QuoteMap = Record<string, { price: number; currency: string; previousClose?: number; changePercent?: number } | null>;
  const [watchlistQuotes, topGainers] = await Promise.all([
    watchlistSymbols.length > 0 ? getQuotes(watchlistSymbols) : Promise.resolve({} as QuoteMap),
    topGainersPeriod === "3d" ? getTopGainers3d(10, halalSet) : getTopGainersDay(10, halalSet),
  ]);

  const marketFeedPreview: { type: "price" | "news"; symbol?: string; title: string; summary?: string; sentiment: "neutral" | "positive" | "negative"; price?: number; changePercent?: number; url?: string; publishedAt: string }[] = [];
  for (const w of watchlist) {
    const q = watchlistQuotes[w.symbol];
    if (q) {
      const sentiment: "neutral" | "positive" | "negative" =
        q.changePercent == null || q.changePercent === 0 ? "neutral" : q.changePercent > 0 ? "positive" : "negative";
      marketFeedPreview.push({
        type: "price",
        symbol: w.symbol,
        title: `${w.symbol} ${q.changePercent != null ? (q.changePercent >= 0 ? "+" : "") + q.changePercent.toFixed(2) + "%" : ""}`,
        sentiment,
        price: q.price,
        changePercent: q.changePercent,
        publishedAt: new Date().toISOString(),
      });
    }
  }
  for (const f of feedItems.slice(0, 8)) {
    marketFeedPreview.push({
      type: "news",
      symbol: f.symbol ?? undefined,
      title: f.title,
      summary: f.summary ?? undefined,
      sentiment: f.sentiment as "neutral" | "positive" | "negative",
      url: f.url ?? undefined,
      publishedAt: f.publishedAt.toISOString(),
    });
  }
  marketFeedPreview.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  const feedPreview = marketFeedPreview.slice(0, 10);

  const netWorthCents = accounts.reduce((sum, a) => sum + a.balanceCents, 0);
  const holdingsValueCents = holdings.reduce(
    (sum, h) => sum + Number(h.quantity) * h.avgCostCents,
    0
  );
  const totalNetWorthCents = netWorthCents + Math.round(holdingsValueCents);

  const nextLesson = academyProgress.find((p) => p.progressPercent < 100 || !p.completedAt);
  const nextAction = nextLesson
    ? {
        type: "academy" as const,
        label: "Continue Lesson",
        lessonId: nextLesson.lessonId,
        lessonTitle: nextLesson.lesson.title,
        moduleSlug: nextLesson.lesson.module.slug,
      }
    : accounts.some((a) => a.type === "holding" && a.balanceCents === 0)
      ? { type: "invest" as const, label: "Deposit Funds", path: "/invest" }
      : { type: "zakat" as const, label: "Calculate Zakat", path: "/zakat" };

  res.json({
    netWorthSnapshot: {
      totalCents: totalNetWorthCents,
      cashCents: netWorthCents,
      investmentsCents: Math.round(holdingsValueCents),
      currency: "USD",
    },
    accounts: accounts.map((a) => ({
      ...a,
      balanceCents: a.balanceCents,
    })),
    recentActivity: recentTransactions,
    businessProgress: academyProgress.length
      ? {
          lessonsCompleted: academyProgress.filter((p) => p.completedAt).length,
          lastLesson: academyProgress[0]?.lesson?.title,
        }
      : null,
    nextRecommendedAction: nextAction,
    marketFeedPreview: {
      items: feedPreview,
      feedPageUrl: "/feed",
    },
    topGainers: {
      period: topGainersPeriod,
      items: topGainers,
    },
    chatUpdates: {
      communityPageUrl: "/community",
      items: communityPosts.map((p) => ({
        id: p.id,
        title: p.title ?? p.body.slice(0, 60) + (p.body.length > 60 ? "..." : ""),
        excerpt: p.body.slice(0, 120) + (p.body.length > 120 ? "..." : ""),
        channel: p.channel,
        author: p.user,
        createdAt: p.createdAt.toISOString(),
      })),
    },
    academyTopic: latestTopic
      ? {
          id: latestTopic.id,
          title: latestTopic.title,
          summary: latestTopic.summary,
          path: latestTopic.path,
          link: latestTopic.link,
          publishedAt: latestTopic.publishedAt.toISOString(),
        }
      : null,
    toolReleases: toolReleases.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      url: t.url,
      releasedAt: t.releasedAt.toISOString(),
    })),
    academyDashboardUrl: "/academy",
    testMyKnowledgeUrl: "/academy/test",
    workspaceUrl: "/workspace",
    workspace: workspace
      ? { id: workspace.id, companyName: workspace.companyName, hasProjects: workspace._count.projects > 0 }
      : null,
  });
  }
);

/** GET /dashboard/feed – Full feed: watchlist first, then recommended; includes live company news (press releases, SEC, reports) */
router.get(
  "/feed",
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("live").optional().isIn(["0", "1"]),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const userId = req.user.userId;
    const limit = (req.query.limit as number | undefined) ?? 50;
    const includeLiveNews = (req.query.live as string | undefined) !== "0";

    const [watchlist, halalList, feedItems] = await Promise.all([
      prisma.watchlistItem.findMany({ where: { userId }, select: { symbol: true } }),
      prisma.halalSymbol.findMany({ select: { symbol: true, name: true } }),
      prisma.marketFeedItem.findMany({
        orderBy: { publishedAt: "desc" },
        take: 100,
        select: { id: true, symbol: true, title: true, summary: true, sentiment: true, source: true, url: true, publishedAt: true },
      }),
    ]);

    const watchlistSymbols = watchlist.map((w) => w.symbol);
    const watchlistSet = new Set(watchlistSymbols.map((s) => s.toUpperCase()));
    const halalSymbols = halalList.map((h) => h.symbol);
    const recommendedSymbols = halalSymbols.filter((s) => !watchlistSet.has(s.toUpperCase())).slice(0, 20);

    const symbolsForQuotes = [...watchlistSymbols, ...recommendedSymbols];
    const quotesPromise = getQuotes(symbolsForQuotes);
    const liveInsightsPromise = includeLiveNews
      ? getCompanyInsightsBatch([...watchlistSymbols.slice(0, 4), ...recommendedSymbols.slice(0, 2)], 6)
      : Promise.resolve({} as Record<string, { id: string; symbol: string; title: string; summary?: string; publishedAt: string; source: string; type: string; sentiment: "neutral" | "positive" | "negative" }[]>);

    const [quotes, liveInsights] = await Promise.all([quotesPromise, liveInsightsPromise]);

    type FeedItem = {
      section: "watchlist" | "recommended";
      type: "price" | "news";
      symbol?: string;
      name?: string;
      title: string;
      summary?: string;
      sentiment: "neutral" | "positive" | "negative";
      price?: number;
      changePercent?: number;
      url?: string;
      source?: string;
      publishedAt: string;
      newsType?: string;
    };

    const items: FeedItem[] = [];

    for (const sym of watchlistSymbols) {
      const q = quotes[sym];
      if (q) {
        const sentiment: "neutral" | "positive" | "negative" =
          q.changePercent == null || q.changePercent === 0 ? "neutral" : q.changePercent > 0 ? "positive" : "negative";
        items.push({
          section: "watchlist",
          type: "price",
          symbol: sym,
          name: halalList.find((h) => h.symbol === sym)?.name ?? undefined,
          title: `${sym} ${q.changePercent != null ? (q.changePercent >= 0 ? "+" : "") + q.changePercent.toFixed(2) + "%" : ""}`,
          sentiment,
          price: q.price,
          changePercent: q.changePercent,
          publishedAt: new Date().toISOString(),
        });
      }
    }

    for (const f of feedItems) {
      const inWatchlist = f.symbol && watchlistSet.has(f.symbol.toUpperCase());
      items.push({
        section: inWatchlist ? "watchlist" : "recommended",
        type: "news",
        symbol: f.symbol ?? undefined,
        title: f.title,
        summary: f.summary ?? undefined,
        sentiment: f.sentiment as "neutral" | "positive" | "negative",
        url: f.url != null ? f.url : undefined,
        source: f.source != null ? f.source : undefined,
        publishedAt: f.publishedAt.toISOString(),
      });
    }

    for (const sym of Object.keys(liveInsights)) {
      const section = watchlistSet.has(sym.toUpperCase()) ? "watchlist" : "recommended";
      for (const news of liveInsights[sym]) {
        items.push({
          section,
          type: "news",
          symbol: news.symbol,
          name: halalList.find((h) => h.symbol.toUpperCase() === sym)?.name ?? undefined,
          title: news.title,
          summary: news.summary,
          sentiment: news.sentiment,
          source: news.source,
          publishedAt: news.publishedAt,
          newsType: news.type,
        });
      }
    }

    for (const sym of recommendedSymbols) {
      const q = quotes[sym];
      if (q) {
        const sentiment: "neutral" | "positive" | "negative" =
          q.changePercent == null || q.changePercent === 0 ? "neutral" : q.changePercent > 0 ? "positive" : "negative";
        items.push({
          section: "recommended",
          type: "price",
          symbol: sym,
          name: halalList.find((h) => h.symbol === sym)?.name ?? undefined,
          title: `${sym} ${q.changePercent != null ? (q.changePercent >= 0 ? "+" : "") + q.changePercent.toFixed(2) + "%" : ""}`,
          sentiment,
          price: q.price,
          changePercent: q.changePercent,
          publishedAt: new Date().toISOString(),
        });
      }
    }

    items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    res.json({
      sections: [
        { section: "watchlist", items: items.filter((i) => i.section === "watchlist").slice(0, limit) },
        { section: "recommended", items: items.filter((i) => i.section === "recommended").slice(0, limit) },
      ],
      allItems: items.slice(0, limit),
      liveNewsEnabled: includeLiveNews,
    });
  }
);

export default router;
