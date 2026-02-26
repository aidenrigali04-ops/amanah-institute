import { Router, Request, Response } from "express";
import { body, param, validationResult } from "express-validator";
import { authMiddleware } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();
router.use(authMiddleware);

const NISAB_CENTS = 5950_00; // ~$5950 in cents (silver nisab approx, configurable later)

/** GET /zakat – dashboard: current year calc + history */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const userId = req.user.userId;
  const year = new Date().getFullYear();

  const [current, history, accounts, holdings] = await Promise.all([
    prisma.zakatCalculation.findUnique({
      where: { userId_year: { userId, year } },
    }),
    prisma.zakatCalculation.findMany({
      where: { userId },
      orderBy: { year: "desc" },
      take: 10,
    }),
    prisma.account.findMany({
      where: { userId },
      select: { id: true, type: true, name: true, balanceCents: true },
    }),
    prisma.portfolioHolding.findMany({
      where: { userId },
      select: { symbol: true, quantity: true, avgCostCents: true, dividendPurificationCents: true },
    }),
  ]);

  const cashCents = accounts.reduce((s, a) => s + a.balanceCents, 0);
  const investmentsCents = holdings.reduce(
    (s, h) => s + Number(h.quantity) * h.avgCostCents,
    0
  );
  const purificationCents = holdings.reduce((s, h) => s + h.dividendPurificationCents, 0);
  const eligibleCents = cashCents + Math.round(investmentsCents);
  const zakatRate = 0.025;
  const zakatDueCents = eligibleCents >= NISAB_CENTS ? Math.round(eligibleCents * zakatRate) : 0;
  const assetBreakdown = {
    cashCents,
    investmentsCents: Math.round(investmentsCents),
    dividendPurificationCents: purificationCents,
  };

  res.json({
    nisabCents: NISAB_CENTS,
    currentYear: year,
    eligibleCents,
    zakatDueCents,
    assetBreakdown,
    dividendPurificationCents: purificationCents,
    savedCalculation: current ?? null,
    history,
  });
});

/** POST /zakat/calculate – save/update calculation for a year */
router.post(
  "/calculate",
  [
    body("year").optional().isInt({ min: 2000, max: 2100 }).toInt(),
    body("eligibleCents").isInt({ min: 0 }),
    body("zakatDueCents").isInt({ min: 0 }),
    body("assetBreakdown").optional().isObject(),
    body("dividendPurificationCents").optional().isInt({ min: 0 }).toInt(),
    body("status").optional().isIn(["draft", "final"]),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const userId = req.user.userId;
    const year = (req.body.year as number) ?? new Date().getFullYear();
    const {
      eligibleCents,
      zakatDueCents,
      assetBreakdown,
      dividendPurificationCents,
      status,
    } = req.body as {
      eligibleCents: number;
      zakatDueCents: number;
      assetBreakdown?: Record<string, unknown>;
      dividendPurificationCents?: number;
      status?: "draft" | "final";
    };

    const calc = await prisma.zakatCalculation.upsert({
      where: { userId_year: { userId, year } },
      create: {
        userId,
        year,
        nisabCents: NISAB_CENTS,
        eligibleCents,
        zakatDueCents,
        assetBreakdown: assetBreakdown ? JSON.stringify(assetBreakdown) : null,
        dividendPurificationCents: dividendPurificationCents ?? 0,
        status: status ?? "draft",
      },
      update: {
        eligibleCents,
        zakatDueCents,
        assetBreakdown: assetBreakdown ? JSON.stringify(assetBreakdown) : undefined,
        dividendPurificationCents: dividendPurificationCents ?? undefined,
        status: status ?? undefined,
      },
    });
    res.json(calc);
  }
);

/** GET /zakat/history – list past years */
router.get("/history", async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const list = await prisma.zakatCalculation.findMany({
    where: { userId: req.user.userId },
    orderBy: { year: "desc" },
  });
  res.json({ history: list });
});

/** GET /zakat/report/:year – get report for download (JSON summary) */
router.get(
  "/report/:year",
  param("year").isInt({ min: 2000, max: 2100 }).toInt(),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) return;
    const year = Number(req.params.year);
    const calc = await prisma.zakatCalculation.findUnique({
      where: {
        userId_year: { userId: req.user.userId, year },
      },
    });
    if (!calc) {
      res.status(404).json({ error: "Calculation not found for this year" });
      return;
    }
    res.json({
      year: calc.year,
      nisabCents: calc.nisabCents,
      eligibleCents: calc.eligibleCents,
      zakatDueCents: calc.zakatDueCents,
      assetBreakdown: calc.assetBreakdown ? JSON.parse(calc.assetBreakdown) : null,
      dividendPurificationCents: calc.dividendPurificationCents,
      status: calc.status,
      createdAt: calc.createdAt,
    });
  }
);

export default router;
