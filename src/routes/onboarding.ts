import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { authMiddleware } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();
router.use(authMiddleware);

const VALID_PATHS = ["business", "investing", "both"];
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
    },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

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
      // Create default accounts for investing path
      if (onboardingPath === "investing" || onboardingPath === "both") {
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

export default router;
