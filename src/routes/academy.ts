import { Router, Request, Response } from "express";
import { body, param, validationResult } from "express-validator";
import { authMiddleware } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { recordAcademyActivity } from "../services/academyStreak.js";

const router = Router();

/** GET /academy/dashboard – Amanah Wealth Academy dashboard: stats, continue, paths, recent badges */
router.get("/dashboard", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const userId = req.user.userId;

  const [modules, progressList, userBadges, user] = await Promise.all([
    prisma.academyModule.findMany({
      orderBy: { orderIndex: "asc" },
      include: {
        lessons: {
          orderBy: { orderIndex: "asc" },
          select: { id: true, slug: true, title: true, durationMinutes: true, orderIndex: true },
        },
      },
    }),
    prisma.academyProgress.findMany({
      where: { userId },
      select: { lessonId: true, progressPercent: true, completedAt: true },
    }),
    prisma.userBadge.findMany({
      where: { userId },
      orderBy: { earnedAt: "desc" },
      take: 5,
      include: { badge: { select: { id: true, slug: true, name: true, icon: true, type: true } } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { academyStreakDays: true },
    }),
  ]);

  const progressMap = new Map(progressList.map((p: { lessonId: string; progressPercent: number; completedAt: Date | null }) => [p.lessonId, p]));
  const allLessons = await prisma.academyLesson.findMany({
    orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
    include: { module: { select: { slug: true, title: true } } },
  });
  const continueLesson = allLessons.find((l) => !progressMap.get(l.id)?.completedAt);

  const totalLessons = modules.reduce((s: number, m: { lessons: unknown[] }) => s + m.lessons.length, 0);
  const completedLessons = progressList.filter((p: { completedAt: Date | null }) => p.completedAt).length;
  const overallPercent = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const badgesCount = await prisma.userBadge.count({ where: { userId } });

  const learningPaths = modules.map((mod) => ({
    id: mod.id,
    slug: mod.slug,
    title: mod.title,
    description: mod.description,
    orderIndex: mod.orderIndex,
    completedLessons: mod.lessons.filter((l: { id: string }) => progressMap.get(l.id)?.completedAt).length,
    totalLessons: mod.lessons.length,
    lessons: mod.lessons.map((l: { id: string; slug: string; title: string; durationMinutes: number | null; orderIndex: number }) => ({
      ...l,
      progress: progressMap.get(l.id)?.progressPercent ?? 0,
      completedAt: progressMap.get(l.id)?.completedAt ?? null,
    })),
  }));

  res.json({
    stats: {
      overallProgressPercent: overallPercent,
      currentStreakDays: user?.academyStreakDays ?? 0,
      badgesEarned: badgesCount,
    },
    continueLesson: continueLesson
      ? {
          id: continueLesson.id,
          slug: continueLesson.slug,
          title: continueLesson.title,
          description: continueLesson.description,
          durationMinutes: continueLesson.durationMinutes,
          module: continueLesson.module,
          progress: progressMap.get(continueLesson.id)?.progressPercent ?? 0,
        }
      : null,
    learningPaths,
    recentBadges: userBadges.map((ub: { badge: { id: string; slug: string; name: string; icon: string | null; type: string }; earnedAt: Date }) => ({
      ...ub.badge,
      earnedAt: ub.earnedAt,
    })),
  });
});

/** GET /academy/topics – new informative topics (~3x/week); filtered by user onboarding path */
router.get("/topics", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { onboardingPath: true },
  });
  const path = user?.onboardingPath ?? "both";
  const topics = await prisma.academyTopic.findMany({
    where: { path: path === "both" ? "both" : path },
    orderBy: { publishedAt: "desc" },
    take: 20,
    select: { id: true, title: true, summary: true, path: true, link: true, publishedAt: true },
  });
  res.json({ topics });
});

/** GET /academy/tool-releases – new tools announcements (e.g. Loveable AI, design tools) */
router.get("/tool-releases", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const tools = await prisma.toolRelease.findMany({
    orderBy: { releasedAt: "desc" },
    take: limit,
    select: { id: true, name: true, description: true, category: true, url: true, releasedAt: true },
  });
  res.json({ toolReleases: tools });
});

/** GET /academy/test – Test my knowledge (quizzes); placeholder for future implementation */
router.get("/test", authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  res.json({ comingSoon: true, message: "Quizzes and knowledge tests coming soon.", url: "/academy" });
});

/** GET /academy/modules – list all modules with lesson counts and progress */
router.get(
  "/modules",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) return;
    const userId = req.user.userId;

    const modules = await prisma.academyModule.findMany({
      orderBy: { orderIndex: "asc" },
      include: {
        lessons: {
          orderBy: { orderIndex: "asc" },
          select: { id: true, slug: true, title: true, durationMinutes: true, orderIndex: true },
        },
      },
    });

    const progress = await prisma.academyProgress.findMany({
      where: { userId },
      select: { lessonId: true, progressPercent: true, completedAt: true },
    });
    const progressMap = new Map(progress.map((p) => [p.lessonId, p]));

    const result = modules.map((mod) => ({
      id: mod.id,
      slug: mod.slug,
      title: mod.title,
      description: mod.description,
      orderIndex: mod.orderIndex,
      lessons: mod.lessons.map((l) => ({
        ...l,
        progress: progressMap.get(l.id)?.progressPercent ?? 0,
        completedAt: progressMap.get(l.id)?.completedAt ?? null,
      })),
      completedLessons: mod.lessons.filter((l) => progressMap.get(l.id)?.completedAt).length,
      totalLessons: mod.lessons.length,
    }));

    res.json({ modules: result });
  }
);

/** GET /academy/lessons/:lessonId – get single lesson (with progress and action assignment responses) */
router.get(
  "/lessons/:lessonId",
  authMiddleware,
  param("lessonId").isString().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const { lessonId } = req.params;
    const userId = req.user.userId;

    const lesson = await prisma.academyLesson.findUnique({
      where: { id: lessonId },
      include: {
        module: { select: { id: true, slug: true, title: true, orderIndex: true } },
      },
    });
    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }

    const [progress, actionResponse] = await Promise.all([
      prisma.academyProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId } },
      }),
      prisma.actionAssignmentResponse.findUnique({
        where: { userId_lessonId: { userId, lessonId } },
      }),
    ]);

    await recordAcademyActivity(userId);
    await prisma.academyProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, lastActivityAt: new Date() },
      update: { lastActivityAt: new Date() },
    });

    let actionAssignmentSchema: unknown = null;
    if (lesson.actionAssignmentSchema) {
      try {
        actionAssignmentSchema = JSON.parse(lesson.actionAssignmentSchema) as unknown;
      } catch {
        actionAssignmentSchema = [];
      }
    }

    res.json({
      ...lesson,
      actionAssignmentSchema,
      actionResponses: actionResponse?.responses ? (JSON.parse(actionResponse.responses) as Record<string, string>) : {},
      progress: progress?.progressPercent ?? 0,
      completedAt: progress?.completedAt ?? null,
    });
  }
);

/** POST /academy/lessons/:lessonId/progress – update progress (percent, complete); records activity for streak */
router.post(
  "/lessons/:lessonId/progress",
  authMiddleware,
  param("lessonId").isString().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const { lessonId } = req.params;
    const { progressPercent, completed } = req.body as { progressPercent?: number; completed?: boolean };
    const userId = req.user.userId;

    const lesson = await prisma.academyLesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }

    await recordAcademyActivity(userId);

    const percent = Math.min(100, Math.max(0, Number(progressPercent) || 0));
    const completedAt = completed === true ? new Date() : undefined;

    const progress = await prisma.academyProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        progressPercent: percent,
        completedAt: completedAt ?? null,
        lastActivityAt: new Date(),
      },
      update: {
        progressPercent: percent,
        lastActivityAt: new Date(),
        ...(completedAt && { completedAt }),
      },
    });

    res.json(progress);
  }
);

/** POST /academy/lessons/:lessonId/action – save Action Assignment responses */
router.post(
  "/lessons/:lessonId/action",
  authMiddleware,
  param("lessonId").isString().notEmpty(),
  body("responses").isObject(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const { lessonId } = req.params;
    const { responses } = req.body as { responses: Record<string, string> };
    const userId = req.user.userId;

    const lesson = await prisma.academyLesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }

    const normalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(responses)) {
      if (typeof v === "string") normalized[k] = v;
    }
    const json = JSON.stringify(normalized);

    const row = await prisma.actionAssignmentResponse.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, responses: json, updatedAt: new Date() },
      update: { responses: json, updatedAt: new Date() },
    });
    res.json({ saved: true, responses: JSON.parse(row.responses) });
  }
);

/** GET /academy/badges – list my earned badges */
router.get("/badges", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const list = await prisma.userBadge.findMany({
    where: { userId: req.user.userId },
    orderBy: { earnedAt: "desc" },
    include: { badge: true },
  });
  res.json({ badges: list.map((ub) => ({ ...ub.badge, earnedAt: ub.earnedAt })) });
});

/** GET /academy/lessons/:lessonId/prev-next – get previous and next lesson in path */
router.get(
  "/lessons/:lessonId/prev-next",
  authMiddleware,
  param("lessonId").isString().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) return;
    const { lessonId } = req.params;
    const lesson = await prisma.academyLesson.findUnique({
      where: { id: lessonId },
      include: { module: true },
    });
    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }
    const allInModule = await prisma.academyLesson.findMany({
      where: { moduleId: lesson.moduleId },
      orderBy: { orderIndex: "asc" },
      select: { id: true, slug: true, title: true, orderIndex: true },
    });
    const idx = allInModule.findIndex((l) => l.id === lessonId);
    const prev = idx > 0 ? allInModule[idx - 1] : null;
    const next = idx >= 0 && idx < allInModule.length - 1 ? allInModule[idx + 1] : null;
    res.json({ prev, next });
  }
);

/** GET /academy/continue – get "continue lesson" (next incomplete) */
router.get("/continue", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const userId = req.user.userId;

  const allLessons = await prisma.academyLesson.findMany({
    orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
    include: { module: { select: { slug: true, title: true } } },
  });
  const progress = await prisma.academyProgress.findMany({
    where: { userId },
    select: { lessonId: true, progressPercent: true, completedAt: true },
  });
  const progressMap = new Map(progress.map((p) => [p.lessonId, p]));

  const next = allLessons.find((l) => {
    const p = progressMap.get(l.id);
    return !p?.completedAt || (p?.progressPercent ?? 0) < 100;
  });

  if (!next) {
    res.json({ lesson: null, message: "All lessons completed" });
    return;
  }

  res.json({
    lesson: {
      id: next.id,
      slug: next.slug,
      title: next.title,
      module: next.module,
      progress: progressMap.get(next.id)?.progressPercent ?? 0,
    },
  });
});

export default router;
