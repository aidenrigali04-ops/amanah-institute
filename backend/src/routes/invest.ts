import { Router, Request, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import { authMiddleware } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { getQuote, getOHLC, getQuotes, searchSymbols, getTopGainersDay, getCompanyInsights } from "../services/marketData.js";

const router = Router();
router.use(authMiddleware);

/** GET /invest/accounts – list user accounts (holding, investment, self_directed) */
router.get("/accounts", async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const accounts = await prisma.account.findMany({
    where: { userId: req.user.userId },
    select: {
      id: true,
      type: true,
      name: true,
      balanceCents: true,
      currency: true,
      createdAt: true,
    },
  });
  res.json({ accounts });
});

/** GET /invest/profile – risk profile and allocation config */
router.get("/profile", async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const profile = await prisma.investmentProfile.findUnique({
    where: { userId: req.user.userId },
  });
  res.json(profile || { riskProfile: null, rebalanceLogic: null });
});

/** PUT /invest/profile – update risk profile */
router.put(
  "/profile",
  body("riskProfile").isIn(["conservative", "balanced", "growth"]),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const { riskProfile } = req.body as { riskProfile: string };
    const profile = await prisma.investmentProfile.upsert({
      where: { userId: req.user.userId },
      create: { userId: req.user.userId, riskProfile },
      update: { riskProfile },
    });
    res.json(profile);
  }
);

/** POST /invest/deposit – deposit into holding account */
router.post(
  "/deposit",
  [
    body("accountId").optional().isString(),
    body("amountCents").isInt({ min: 1 }),
    body("currency").optional().default("USD"),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const userId = req.user.userId;
    const { accountId, amountCents, currency } = req.body as {
      accountId?: string;
      amountCents: number;
      currency: string;
    };

    const holding = accountId
      ? await prisma.account.findFirst({
          where: { id: accountId, userId, type: "holding" },
        })
      : await prisma.account.findFirst({
          where: { userId, type: "holding" },
        });
    if (!holding) {
      res.status(400).json({ error: "Holding account not found" });
      return;
    }

    await prisma.$transaction([
      prisma.account.update({
        where: { id: holding.id },
        data: { balanceCents: { increment: amountCents } },
      }),
      prisma.transaction.create({
        data: {
          userId,
          type: "deposit",
          toAccountId: holding.id,
          amountCents,
          currency,
          status: "completed",
        },
      }),
    ]);

    const updated = await prisma.account.findUnique({
      where: { id: holding.id },
      select: { id: true, balanceCents: true, currency: true },
    });
    res.json({ success: true, account: updated });
  }
);

/** POST /invest/transfer – transfer between own accounts */
router.post(
  "/transfer",
  [
    body("fromAccountId").isString(),
    body("toAccountId").isString(),
    body("amountCents").isInt({ min: 1 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const userId = req.user.userId;
    const { fromAccountId, toAccountId, amountCents } = req.body as {
      fromAccountId: string;
      toAccountId: string;
      amountCents: number;
    };
    if (fromAccountId === toAccountId) {
      res.status(400).json({ error: "From and to account must differ" });
      return;
    }

    const [from, to] = await Promise.all([
      prisma.account.findFirst({ where: { id: fromAccountId, userId } }),
      prisma.account.findFirst({ where: { id: toAccountId, userId } }),
    ]);
    if (!from || !to) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    if (from.balanceCents < amountCents) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }

    await prisma.$transaction([
      prisma.account.update({ where: { id: from.id }, data: { balanceCents: { decrement: amountCents } } }),
      prisma.account.update({ where: { id: to.id }, data: { balanceCents: { increment: amountCents } } }),
      prisma.transaction.create({
        data: {
          userId,
          type: "transfer",
          fromAccountId: from.id,
          toAccountId: to.id,
          amountCents,
          currency: from.currency,
          status: "completed",
        },
      }),
    ]);

    const updated = await prisma.account.findMany({
      where: { id: { in: [from.id, to.id] } },
      select: { id: true, balanceCents: true },
    });
    res.json({ success: true, accounts: updated });
  }
);

/** GET /invest/holdings – portfolio holdings (optionally by account) */
router.get(
  "/holdings",
  query("accountId").optional().isString(),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) return;
    const accountId = req.query.accountId as string | undefined;
    const where = { userId: req.user.userId, ...(accountId && { accountId }) };
    const holdings = await prisma.portfolioHolding.findMany({
      where,
      include: { account: { select: { id: true, type: true, name: true } } },
    });
    res.json({ holdings });
  }
);

/** GET /invest/symbols – halal-approved symbols (for self-directed) */
router.get("/symbols", async (_req: Request, res: Response): Promise<void> => {
  const symbols = await prisma.halalSymbol.findMany({
    orderBy: { symbol: "asc" },
    select: { id: true, symbol: true, name: true, assetType: true },
  });
  res.json({ symbols });
});

/** GET /invest/halal-symbols – Sharia/halal-compliant stocks & ETFs (with optional search) */
router.get(
  "/halal-symbols",
  query("search").optional().isString(),
  query("limit").optional().isInt({ min: 1, max: 200 }).toInt(),
  async (req: Request, res: Response): Promise<void> => {
    const search = (req.query.search as string)?.trim()?.toUpperCase();
    const limit = Number(req.query.limit) || 100;
    let symbols = await prisma.halalSymbol.findMany({
      orderBy: { symbol: "asc" },
      select: { id: true, symbol: true, name: true, assetType: true, lastVerifiedAt: true, createdAt: true },
    });
    if (search) {
      symbols = symbols.filter(
        (s) => s.symbol.toUpperCase().includes(search) || (s.name?.toUpperCase().includes(search))
      ).slice(0, limit);
    } else {
      symbols = symbols.slice(0, limit);
    }
    res.json({
      count: symbols.length,
      symbols: symbols.map((s) => ({
        ...s,
        lastVerifiedAt: s.lastVerifiedAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  }
);

/** GET /invest/market/feed – market feed: halal symbols with current quotes (for dashboards) */
router.get("/market/feed", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const halal = await prisma.halalSymbol.findMany({
    orderBy: { symbol: "asc" },
    select: { symbol: true, name: true, assetType: true },
  });
  const symbols = halal.map((h) => h.symbol);
  const quotes = await getQuotes(symbols);
  const feed = halal.map((h) => ({
    ...h,
    quote: quotes[h.symbol] ?? null,
  }));
  res.json({ feed, updatedAt: new Date().toISOString() });
});

/** GET /invest/market/quotes – batch quotes (symbols=AAPL,MSFT,... or only halal if no param) */
router.get(
  "/market/quotes",
  query("symbols").optional().isString(),
  async (req: Request, res: Response): Promise<void> => {
    let symbols: string[];
    const raw = req.query.symbols as string | undefined;
    if (raw?.trim()) {
      symbols = raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      const halalSet = new Set((await prisma.halalSymbol.findMany({ select: { symbol: true } })).map((h) => h.symbol));
      symbols = symbols.filter((s) => halalSet.has(s));
    } else {
      const halal = await prisma.halalSymbol.findMany({ select: { symbol: true } });
      symbols = halal.map((h) => h.symbol);
    }
    const quotes = await getQuotes(symbols);
    res.json({ quotes });
  }
);

/** GET /invest/market/search – search symbols; returns only halal-approved matches */
router.get(
  "/market/search",
  query("q").isString().notEmpty(),
  query("limit").optional().isInt({ min: 1, max: 30 }).toInt(),
  async (req: Request, res: Response): Promise<void> => {
    const q = (req.query.q as string).trim();
    const limit = Number(req.query.limit) || 15;
    const [yahooResults, halalList] = await Promise.all([
      searchSymbols(q, limit * 2),
      prisma.halalSymbol.findMany({ select: { symbol: true, name: true, assetType: true } }),
    ]);
    const halalSet = new Set(halalList.map((h) => h.symbol.toUpperCase()));
    const halalNames = new Map(halalList.map((h) => [h.symbol.toUpperCase(), h]));
    const filtered = yahooResults
      .filter((r) => halalSet.has(r.symbol.toUpperCase()))
      .slice(0, limit)
      .map((r) => {
        const meta = halalNames.get(r.symbol.toUpperCase());
        return { ...r, name: meta?.name ?? r.shortname, assetType: meta?.assetType ?? null };
      });
    res.json({ results: filtered });
  }
);

/** GET /invest/market/top-gainers – top % gainers; period=1d|1wk|1mo (1d from screener; 1wk/1mo filtered halal, same data for now) */
router.get(
  "/market/top-gainers",
  query("period").optional().isIn(["1d", "1wk", "1mo"]),
  async (req: Request, res: Response): Promise<void> => {
    const period = (req.query.period as "1d" | "1wk" | "1mo") ?? "1d";
    const halal = await prisma.halalSymbol.findMany({ select: { symbol: true } });
    const halalSet = new Set(halal.map((h) => h.symbol.toUpperCase()));
    const gainers = await getTopGainersDay(20, halalSet);
    res.json({ period, items: gainers });
  }
);

/** GET /invest/market/:symbol/news – company news, press releases, SEC filings, analyst reports (halal symbols only) */
router.get(
  "/market/:symbol/news",
  param("symbol").trim().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    const symbol = (req.params.symbol as string).toUpperCase();
    const halal = await prisma.halalSymbol.findUnique({ where: { symbol } });
    if (!halal) {
      res.status(400).json({ error: "Symbol not in halal-approved list." });
      return;
    }
    const news = await getCompanyInsights(symbol);
    res.json({ symbol, items: news });
  }
);

/** GET /invest/market/:symbol/quote – last price for execution and header */
router.get(
  "/market/:symbol/quote",
  param("symbol").trim().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    const symbol = (req.params.symbol as string).toUpperCase();
    const quote = await getQuote(symbol);
    if (!quote) {
      res.status(404).json({ error: "Quote not found for symbol." });
      return;
    }
    res.json(quote);
  }
);

/** GET /invest/market/:symbol/ohlc – OHLC for chart (query: interval=1d|1wk|1mo, range=5d|1mo|3mo|6mo|1y) */
router.get(
  "/market/:symbol/ohlc",
  param("symbol").trim().notEmpty(),
  query("interval").optional().isIn(["1d", "1wk", "1mo"]),
  query("range").optional().isIn(["5d", "1mo", "3mo", "6mo", "1y"]),
  async (req: Request, res: Response): Promise<void> => {
    const symbol = (req.params.symbol as string).toUpperCase();
    const interval = (req.query.interval as "1d" | "1wk" | "1mo") || "1d";
    const range = (req.query.range as string) || "1mo";
    const ohlc = await getOHLC(symbol, interval, range);
    res.json({ symbol, interval, range, data: ohlc });
  }
);

/** GET /invest/transactions – transaction history */
router.get(
  "/transactions",
  [
    query("accountId").optional().isString(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) return;
    const accountId = req.query.accountId as string | undefined;
    const limit = Number(req.query.limit) || 50;
    const where = { userId: req.user.userId, ...(accountId && { OR: [{ fromAccountId: accountId }, { toAccountId: accountId }] }) };
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json({ transactions });
  }
);

/** POST /invest/withdraw – withdraw from holding */
router.post(
  "/withdraw",
  [
    body("accountId").optional().isString(),
    body("amountCents").isInt({ min: 1 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const userId = req.user.userId;
    const { accountId, amountCents } = req.body as { accountId?: string; amountCents: number };
    const holding = accountId
      ? await prisma.account.findFirst({ where: { id: accountId, userId, type: "holding" } })
      : await prisma.account.findFirst({ where: { userId, type: "holding" } });
    if (!holding) {
      res.status(400).json({ error: "Holding account not found" });
      return;
    }
    if (holding.balanceCents < amountCents) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }

    await prisma.$transaction([
      prisma.account.update({
        where: { id: holding.id },
        data: { balanceCents: { decrement: amountCents } },
      }),
      prisma.transaction.create({
        data: {
          userId,
          type: "withdrawal",
          fromAccountId: holding.id,
          amountCents,
          currency: holding.currency,
          status: "completed",
        },
      }),
    ]);
    const updated = await prisma.account.findUnique({
      where: { id: holding.id },
      select: { id: true, balanceCents: true },
    });
    res.json({ success: true, account: updated });
  }
);

// ─── Watchlist ───────────────────────────────────────────────────────────────

/** GET /invest/watchlist – list user's watchlist symbols */
router.get("/watchlist", async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const items = await prisma.watchlistItem.findMany({
    where: { userId: req.user.userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, symbol: true, createdAt: true },
  });
  res.json({ watchlist: items });
});

/** POST /invest/watchlist – add symbol to watchlist (must be halal-approved) */
router.post(
  "/watchlist",
  body("symbol").trim().notEmpty().isLength({ max: 20 }),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const symbol = (req.body.symbol as string).toUpperCase();
    const halal = await prisma.halalSymbol.findUnique({ where: { symbol } });
    if (!halal) {
      res.status(400).json({ error: "Symbol not in halal-approved list. Only approved symbols can be traded or watched." });
      return;
    }
    const item = await prisma.watchlistItem.upsert({
      where: { userId_symbol: { userId: req.user.userId, symbol } },
      create: { userId: req.user.userId, symbol },
      update: {},
      select: { id: true, symbol: true, createdAt: true },
    });
    res.status(201).json(item);
  }
);

/** DELETE /invest/watchlist/:symbol – remove from watchlist */
router.delete(
  "/watchlist/:symbol",
  param("symbol").trim().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) return;
    const symbol = (req.params.symbol as string).toUpperCase();
    await prisma.watchlistItem.deleteMany({
      where: { userId: req.user.userId, symbol },
    });
    res.status(204).send();
  }
);

// ─── Self-directed orders (market: immediate execution) ───────────────────────

/** POST /invest/orders/buy – place buy order (market only for now) */
router.post(
  "/orders/buy",
  [
    body("accountId").optional().isString(),
    body("symbol").trim().notEmpty().isLength({ max: 20 }),
    body("quantity").isFloat({ min: 0.000001 }),
    body("priceCents").isInt({ min: 1 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const userId = req.user.userId;
    const symbol = (req.body.symbol as string).toUpperCase();
    const quantity = Math.round(Number(req.body.quantity) * 1e6) / 1e6;
    const priceCents = Number(req.body.priceCents) as number;
    const accountId = req.body.accountId as string | undefined;

    const [halal, account] = await Promise.all([
      prisma.halalSymbol.findUnique({ where: { symbol } }),
      accountId
        ? prisma.account.findFirst({ where: { id: accountId, userId, type: "self_directed" } })
        : prisma.account.findFirst({ where: { userId, type: "self_directed" } }),
    ]);
    if (!halal) {
      res.status(400).json({ error: "Symbol not in halal-approved list." });
      return;
    }
    if (!account) {
      res.status(400).json({ error: "Self-directed account not found." });
      return;
    }
    const costCents = Math.round(quantity * priceCents);
    if (account.balanceCents < costCents) {
      res.status(400).json({ error: "Insufficient balance in self-directed account.", requiredCents: costCents, balanceCents: account.balanceCents });
      return;
    }

    const existing = await prisma.portfolioHolding.findUnique({
      where: { accountId_symbol: { accountId: account.id, symbol } },
    });
    const newQuantity = existing ? Number(existing.quantity) + quantity : quantity;
    const newCostCents = existing ? existing.avgCostCents * Number(existing.quantity) + costCents : costCents;
    const newAvgCostCents = Math.round(newCostCents / newQuantity);

    const [order, updatedHolding] = await prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.create({
        data: {
          userId,
          type: "buy",
          fromAccountId: account.id,
          amountCents: costCents,
          currency: "USD",
          symbol,
          quantity,
          priceCents,
          status: "completed",
        },
      });
      await tx.account.update({
        where: { id: account.id },
        data: { balanceCents: { decrement: costCents } },
      });
      await tx.portfolioHolding.upsert({
        where: { accountId_symbol: { accountId: account.id, symbol } },
        create: {
          userId,
          accountId: account.id,
          symbol,
          quantity,
          avgCostCents: priceCents,
          source: "trade",
        },
        update: {
          quantity: newQuantity,
          avgCostCents: newAvgCostCents,
          updatedAt: new Date(),
        },
      });
      const orderRow = await tx.order.create({
        data: {
          userId,
          accountId: account.id,
          symbol,
          side: "buy",
          orderType: "market",
          quantity,
          status: "completed",
          executionPriceCents: priceCents,
          executionQuantity: quantity,
          transactionId: txn.id,
          completedAt: new Date(),
        },
      });
      const holding = await tx.portfolioHolding.findUnique({
        where: { accountId_symbol: { accountId: account.id, symbol } },
      });
      return [orderRow, holding];
    });

    res.status(201).json({
      order: {
        id: order.id,
        symbol: order.symbol,
        side: order.side,
        orderType: order.orderType,
        quantity: Number(order.quantity),
        executionPriceCents: order.executionPriceCents,
        executionQuantity: Number(order.executionQuantity),
        status: order.status,
        completedAt: order.completedAt,
        createdAt: order.createdAt,
      },
      holding: updatedHolding
        ? {
            symbol: updatedHolding.symbol,
            quantity: Number(updatedHolding.quantity),
            avgCostCents: updatedHolding.avgCostCents,
          }
        : null,
    });
  }
);

/** POST /invest/orders/sell – place sell order (market) */
router.post(
  "/orders/sell",
  [
    body("accountId").optional().isString(),
    body("symbol").trim().notEmpty().isLength({ max: 20 }),
    body("quantity").isFloat({ min: 0.000001 }),
    body("priceCents").isInt({ min: 1 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const userId = req.user.userId;
    const symbol = (req.body.symbol as string).toUpperCase();
    const quantity = Math.round(Number(req.body.quantity) * 1e6) / 1e6;
    const priceCents = Number(req.body.priceCents) as number;
    const accountId = req.body.accountId as string | undefined;

    const account = accountId
      ? await prisma.account.findFirst({ where: { id: accountId, userId, type: "self_directed" } })
      : await prisma.account.findFirst({ where: { userId, type: "self_directed" } });
    if (!account) {
      res.status(400).json({ error: "Self-directed account not found." });
      return;
    }
    const holding = await prisma.portfolioHolding.findUnique({
      where: { accountId_symbol: { accountId: account.id, symbol } },
    });
    if (!holding) {
      res.status(400).json({ error: "No holding for this symbol in the selected account." });
      return;
    }
    const available = Number(holding.quantity);
    if (quantity > available) {
      res.status(400).json({ error: "Insufficient quantity to sell.", available, requested: quantity });
      return;
    }
    const proceedsCents = Math.round(quantity * priceCents);

    const [order, updatedHolding] = await prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.create({
        data: {
          userId,
          type: "sell",
          toAccountId: account.id,
          amountCents: proceedsCents,
          currency: "USD",
          symbol,
          quantity,
          priceCents,
          status: "completed",
        },
      });
      await tx.account.update({
        where: { id: account.id },
        data: { balanceCents: { increment: proceedsCents } },
      });
      const newQty = available - quantity;
      if (newQty < 1e-9) {
        await tx.portfolioHolding.delete({
          where: { id: holding.id },
        });
      } else {
        await tx.portfolioHolding.update({
          where: { id: holding.id },
          data: { quantity: newQty, updatedAt: new Date() },
        });
      }
      const orderRow = await tx.order.create({
        data: {
          userId,
          accountId: account.id,
          symbol,
          side: "sell",
          orderType: "market",
          quantity,
          status: "completed",
          executionPriceCents: priceCents,
          executionQuantity: quantity,
          transactionId: txn.id,
          completedAt: new Date(),
        },
      });
      const h = await tx.portfolioHolding.findUnique({
        where: { accountId_symbol: { accountId: account.id, symbol } },
      });
      return [orderRow, h];
    });

    res.status(201).json({
      order: {
        id: order.id,
        symbol: order.symbol,
        side: order.side,
        orderType: order.orderType,
        quantity: Number(order.quantity),
        executionPriceCents: order.executionPriceCents,
        executionQuantity: Number(order.executionQuantity),
        status: order.status,
        completedAt: order.completedAt,
        createdAt: order.createdAt,
      },
      holding: updatedHolding
        ? {
            symbol: updatedHolding.symbol,
            quantity: Number(updatedHolding.quantity),
            avgCostCents: updatedHolding.avgCostCents,
          }
        : null,
    });
  }
);

/** GET /invest/analytics – allocation breakdown (by account and symbol) */
router.get("/analytics", async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const userId = req.user.userId;
  const [holdings, accounts] = await Promise.all([
    prisma.portfolioHolding.findMany({
      where: { userId },
      include: { account: { select: { id: true, type: true, name: true } } },
    }),
    prisma.account.findMany({
      where: { userId },
      select: { id: true, type: true, name: true, balanceCents: true },
    }),
  ]);
  const byAccount = new Map<string, { accountId: string; type: string; name: string | null; cashCents: number; positions: { symbol: string; quantity: number; avgCostCents: number; valueCents: number }[]; totalValueCents: number }>();
  for (const a of accounts) {
    byAccount.set(a.id, {
      accountId: a.id,
      type: a.type,
      name: a.name,
      cashCents: a.balanceCents,
      positions: [],
      totalValueCents: a.balanceCents,
    });
  }
  for (const h of holdings) {
    const row = byAccount.get(h.accountId);
    if (!row) continue;
    const qty = Number(h.quantity);
    const valueCents = Math.round(qty * h.avgCostCents);
    row.positions.push({
      symbol: h.symbol,
      quantity: qty,
      avgCostCents: h.avgCostCents,
      valueCents,
    });
    row.totalValueCents += valueCents;
  }
  const totalPortfolioCents = [...byAccount.values()].reduce((s, a) => s + a.totalValueCents, 0);
  res.json({
    byAccount: [...byAccount.values()],
    totalPortfolioCents,
    currency: "USD",
  });
});

/** GET /invest/orders – order history */
router.get(
  "/orders",
  [
    query("accountId").optional().isString(),
    query("status").optional().isIn(["pending", "completed", "cancelled"]),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) return;
    const accountId = req.query.accountId as string | undefined;
    const status = req.query.status as string | undefined;
    const limit = Number(req.query.limit) || 50;
    const where = { userId: req.user.userId, ...(accountId && { accountId }), ...(status && { status }) };
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        symbol: true,
        side: true,
        orderType: true,
        quantity: true,
        limitPriceCents: true,
        status: true,
        executionPriceCents: true,
        executionQuantity: true,
        createdAt: true,
        completedAt: true,
        accountId: true,
      },
    });
    res.json({
      orders: orders.map((o) => ({
        ...o,
        quantity: Number(o.quantity),
        executionQuantity: o.executionQuantity != null ? Number(o.executionQuantity) : null,
      })),
    });
  }
);

export default router;
