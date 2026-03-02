import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { authMiddleware } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();
router.use(authMiddleware);

const VALID_PATHS = ["business", "investing", "both", "not_sure"];
const VALID_LEVELS = ["beginner", "intermediate", "advanced"];
const VALID_RISK = ["conservative", "balanced", "growth"];

router.get("/status", async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      onboardingDone: true,
      experienceLevel: true,
      riskProfile: true,
      onboardingPath: true,
      goals: true,
      academyPersonalizedAt: true,
      tradingAccountOpenedAt: true,
    },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    ...user,
    academyPersonalized: !!user.academyPersonalizedAt,
    tradingAccountOpened: !!user.tradingAccountOpenedAt,
  });
});

/** POST /onboarding – Save onboarding answers. All provided fields are persisted per user; dashboard uses them for personalization. */
router.post(
  "/",
  [
    body("experienceLevel").optional().isIn(VALID_LEVELS),
    body("riskProfile").optional().isIn(VALID_RISK),
    body("onboardingPath").optional().isIn(VALID_PATHS),
    body("goals").optional().isString(),
    body("complete").optional().isBoolean(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;

    const { experienceLevel, riskProfile, onboardingPath, goals, complete } = req.body as {
      experienceLevel?: string;
      riskProfile?: string;
      onboardingPath?: string;
      goals?: string;
      complete?: boolean;
    };

    const update: Record<string, unknown> = {};
    if (experienceLevel != null) update.experienceLevel = experienceLevel;
    if (riskProfile != null) update.riskProfile = riskProfile;
    if (onboardingPath != null) update.onboardingPath = onboardingPath;
    if (goals != null) update.goals = goals;
    if (complete === true) {
      update.onboardingDone = true;
      // Create default accounts for investing path (and not_sure so they can explore both)
      if (onboardingPath === "investing" || onboardingPath === "both" || onboardingPath === "not_sure") {
        const existing = await prisma.account.count({ where: { userId: req.user.userId } });
        if (existing === 0) {
          await prisma.account.createMany({
            data: [
              { userId: req.user.userId, type: "holding", name: "Holding", currency: "USD" },
              { userId: req.user.userId, type: "investment", name: "Automated Portfolio", currency: "USD" },
              { userId: req.user.userId, type: "self_directed", name: "Self-Directed", currency: "USD" },
            ],
          });
        }
        // Create investment profile if risk set
        if (riskProfile) {
          await prisma.investmentProfile.upsert({
            where: { userId: req.user.userId },
            create: { userId: req.user.userId, riskProfile },
            update: { riskProfile },
          });
        }
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: update,
      select: {
        onboardingDone: true,
        experienceLevel: true,
        riskProfile: true,
        onboardingPath: true,
        goals: true,
      },
    });
    res.json(user);
  }
);

const VALID_PATHWAY = ["starter", "builder", "scaler"];
const VALID_STAGE = ["pre_revenue", "first_offer", "first_client", "revenue_1k", "systemized"];

/** POST /onboarding/academy – Business academy questionnaire. Saves preferences and sets academy as personalized. */
router.post(
  "/academy",
  [
    body("experienceLevel").optional().isIn(VALID_LEVELS),
    body("pathway").optional().isIn(VALID_PATHWAY),
    body("incomeGoalMonthlyCents").optional().isInt({ min: 0 }).toInt(),
    body("incomeGoalPeriodMonths").optional().isInt({ min: 1, max: 60 }).toInt(),
    body("currentStage").optional().isIn(VALID_STAGE),
    body("currentMilestone").optional().trim(),
    body("businessPreferences").optional().isObject(),
    body("goals").optional().isString(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const {
      experienceLevel,
      pathway,
      incomeGoalMonthlyCents,
      incomeGoalPeriodMonths,
      currentStage,
      currentMilestone,
      businessPreferences,
      goals,
    } = req.body as {
      experienceLevel?: string;
      pathway?: string;
      incomeGoalMonthlyCents?: number;
      incomeGoalPeriodMonths?: number;
      currentStage?: string;
      currentMilestone?: string;
      businessPreferences?: Record<string, unknown>;
      goals?: string;
    };
    const update: Record<string, unknown> = {
      academyPersonalizedAt: new Date(),
    };
    if (experienceLevel != null) update.experienceLevel = experienceLevel;
    if (pathway != null) update.pathway = pathway;
    if (incomeGoalMonthlyCents != null) update.incomeGoalMonthlyCents = incomeGoalMonthlyCents;
    if (incomeGoalPeriodMonths != null) update.incomeGoalPeriodMonths = incomeGoalPeriodMonths;
    if (currentStage != null) update.currentStage = currentStage;
    if (currentMilestone != null) update.currentMilestone = currentMilestone;
    if (businessPreferences != null) update.businessPreferences = JSON.stringify(businessPreferences);
    if (goals != null) update.goals = goals;

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: update,
      select: {
        experienceLevel: true,
        pathway: true,
        incomeGoalMonthlyCents: true,
        incomeGoalPeriodMonths: true,
        currentStage: true,
        currentMilestone: true,
        academyPersonalizedAt: true,
      },
    });
    res.status(201).json({ ...user, academyPersonalized: true });
  }
);

/** POST /onboarding/trading – Trading account questionnaire. Ensures accounts exist, sets risk profile, marks trading account opened. */
router.post(
  "/trading",
  [
    body("riskProfile").isIn(VALID_RISK),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const { riskProfile } = req.body as { riskProfile: string };
    const userId = req.user.userId;

    const existingAccounts = await prisma.account.count({ where: { userId } });
    if (existingAccounts === 0) {
      await prisma.account.createMany({
        data: [
          { userId, type: "holding", name: "Holding", currency: "USD" },
          { userId, type: "investment", name: "Automated Portfolio", currency: "USD" },
          { userId, type: "self_directed", name: "Self-Directed", currency: "USD" },
        ],
      });
    }
    await prisma.investmentProfile.upsert({
      where: { userId },
      create: { userId, riskProfile },
      update: { riskProfile },
    });

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        riskProfile,
        tradingAccountOpenedAt: new Date(),
      },
      select: {
        riskProfile: true,
        tradingAccountOpenedAt: true,
      },
    });
    res.status(201).json({ ...user, tradingAccountOpened: true });
  }
);

export default router;
