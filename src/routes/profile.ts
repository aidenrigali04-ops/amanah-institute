import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { authMiddleware } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();
router.use(authMiddleware);

/** GET /profile – current user profile */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      experienceLevel: true,
      riskProfile: true,
      onboardingPath: true,
      onboardingDone: true,
      goals: true,
      notificationsOn: true,
      theme: true,
      academyStreakDays: true,
      createdAt: true,
      parentId: true,
      familyPermissions: true,
    },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

/** PATCH /profile – update profile fields */
router.patch(
  "/",
  [
    body("firstName").optional().trim().notEmpty(),
    body("lastName").optional().trim().notEmpty(),
    body("phone").optional().trim(),
    body("notificationsOn").optional().isBoolean(),
    body("theme").optional().isIn(["light", "dark"]),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const { firstName, lastName, phone, notificationsOn, theme } = req.body as {
      firstName?: string;
      lastName?: string;
      phone?: string;
      notificationsOn?: boolean;
      theme?: string;
    };
    const update: Record<string, unknown> = {};
    if (firstName !== undefined) update.firstName = firstName;
    if (lastName !== undefined) update.lastName = lastName;
    if (phone !== undefined) update.phone = phone;
    if (notificationsOn !== undefined) update.notificationsOn = notificationsOn;
    if (theme !== undefined) update.theme = theme;

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: update,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        notificationsOn: true,
        theme: true,
      },
    });
    res.json(user);
  }
);

/** GET /profile/family – list child accounts (if parent) */
router.get("/family", async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const children = await prisma.user.findMany({
    where: { parentId: req.user.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      familyPermissions: true,
      createdAt: true,
    },
  });
  res.json({ children });
});

/** POST /profile/family/invite – parent invites child (creates child user or links existing) */
router.post(
  "/family/invite",
  [
    body("email").isEmail().normalizeEmail(),
    body("firstName").trim().notEmpty(),
    body("lastName").trim().notEmpty(),
    body("password").optional().isLength({ min: 8 }),
    body("permissions").optional().isString(), // e.g. "view_only"
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const parentId = req.user.userId;
    const { email, firstName, lastName, password, permissions } = req.body as {
      email: string;
      firstName: string;
      lastName: string;
      password?: string;
      permissions?: string;
    };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.parentId) {
        res.status(400).json({ error: "User is already linked to another family" });
        return;
      }
      await prisma.user.update({
        where: { id: existing.id },
        data: { parentId, familyPermissions: permissions ?? "view_only" },
      });
      await prisma.familyActivityLog.create({
        data: { parentId, childId: existing.id, action: "linked_existing", details: "Child account linked" },
      });
      res.status(201).json({
        child: {
          id: existing.id,
          email: existing.email,
          firstName: existing.firstName,
          lastName: existing.lastName,
          familyPermissions: permissions ?? "view_only",
        },
        linked: true,
      });
      return;
    }

    if (!password) {
      res.status(400).json({ error: "Password required to create new child account" });
      return;
    }
    const bcrypt = await import("bcrypt");
    const passwordHash = await bcrypt.default.hash(password, 12);
    const child = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        parentId,
        familyPermissions: permissions ?? "view_only",
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        familyPermissions: true,
      },
    });
    await prisma.familyActivityLog.create({
      data: { parentId, childId: child.id, action: "invited", details: "New child account created" },
    });
    res.status(201).json({ child, linked: false });
  }
);

/** GET /profile/family/activity – parent views activity log for children */
router.get("/family/activity", async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const logs = await prisma.familyActivityLog.findMany({
    where: { parentId: req.user.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      child: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  res.json({ activity: logs });
});

export default router;
