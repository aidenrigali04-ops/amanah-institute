import { Router, Request, Response } from "express";
import { body, param, validationResult } from "express-validator";
import { authMiddleware } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { recordAcademyActivity } from "../services/academyStreak.js";
import {
  PATHWAY_LABELS,
  EXPERIENCE_LABELS,
  MILESTONE_LADDER,
  BUILDER_INSIGHTS,
  TEMPLATES_SHORTCUT,
  NEXT_ACTION_SUGGESTIONS,
  MODULE_CATEGORY,
} from "../data/academyHome.js";

const router = Router();

/** Start of week (Monday) for a given date. */
function getWeekStart(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** GET /academy/home – Academy Homepage Dashboard: progress, income direction, next actions, modules, insights, workspace link. */
router.get("/home", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const userId = req.user.userId;

  const [user, modules, progressList, userBadges, thisWeekCheckIn, allLessons] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        experienceLevel: true,
        pathway: true,
        incomeGoalMonthlyCents: true,
        incomeGoalPeriodMonths: true,
        currentStage: true,
        currentMilestone: true,
        academyStreakDays: true,
      },
    }),
    prisma.academyModule.findMany({
      orderBy: { orderIndex: "asc" },
      include: {
        lessons: { orderBy: { orderIndex: "asc" }, select: { id: true, slug: true, title: true, orderIndex: true } },
      },
    }),
    prisma.academyProgress.findMany({
      where: { userId },
      select: { lessonId: true, progressPercent: true, completedAt: true },
    }),
    prisma.userBadge.findMany({
      where: { userId },
      orderBy: { earnedAt: "desc" },
      take: 10,
      include: { badge: { select: { id: true, slug: true, name: true, icon: true, type: true } } },
    }),
    (async () => {
      const weekStart = getWeekStart(new Date());
      return prisma.builderCheckIn.findUnique({
        where: { userId_weekStartDate: { userId, weekStartDate: weekStart } },
      });
    })(),
    prisma.academyLesson.findMany({
      orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
      include: { module: { select: { id: true, slug: true, title: true } } },
    }),
  ]);

  const progressMap = new Map(progressList.map((p) => [p.lessonId, p]));
  const totalLessons = modules.reduce((s, m) => s + m.lessons.length, 0);
  const completedLessons = progressList.filter((p) => p.completedAt).length;
  const overallPercent = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const continueLesson = allLessons.find((l) => !progressMap.get(l.id)?.completedAt);

  const experienceLevel = user?.experienceLevel ?? "beginner";
  let pathway = user?.pathway ?? null;
  if (!pathway) {
    if (overallPercent >= 75) pathway = "scaler";
    else if (overallPercent >= 25) pathway = "builder";
    else pathway = "starter";
  }

  const pathwayBadge = {
    pathway: PATHWAY_LABELS[pathway] ?? pathway,
    pathwayKey: pathway,
    experienceLevel: EXPERIENCE_LABELS[experienceLevel] ?? experienceLevel,
    experienceLevelKey: experienceLevel,
  };

  const currentFocusModule = continueLesson?.module ?? modules[0] ?? null;
  const progressBar = {
    percentCompleted: overallPercent,
    modulesCompleted: modules.filter((m) => m.lessons.every((l) => progressMap.get(l.id)?.completedAt)).length,
    totalModules: modules.length,
    currentStage: currentFocusModule?.title ?? "Getting started",
    currentStageModuleSlug: currentFocusModule?.slug ?? null,
  };

  let primaryActionLabel = "Continue Lesson";
  let primaryActionType: "continue_lesson" | "build_offer" | "validate_idea" = "continue_lesson";
  if (continueLesson) {
    if (continueLesson.module.slug === "offer-revenue" && continueLesson.slug.includes("offer")) primaryActionLabel = "Build Your Offer";
    else if (continueLesson.module.slug === "foundations") primaryActionLabel = "Validate Your Idea";
  }
  if (primaryActionLabel === "Build Your Offer") primaryActionType = "build_offer";
  else if (primaryActionLabel === "Validate Your Idea") primaryActionType = "validate_idea";

  const primaryAction = {
    label: primaryActionLabel,
    type: primaryActionType,
    lessonId: continueLesson?.id ?? null,
    lessonSlug: continueLesson?.slug ?? null,
    moduleSlug: continueLesson?.module.slug ?? null,
    url: continueLesson ? `/academy/lessons/${continueLesson.id}` : "/academy",
  };

  const currentStage = user?.currentStage ?? "pre_revenue";
  const currentMilestone = user?.currentMilestone ?? "Define niche";
  const stageOrder = ["pre_revenue", "first_offer", "first_client", "revenue_1k", "systemized"];

  const incomeGoal = {
    goalMonthlyCents: user?.incomeGoalMonthlyCents ?? null,
    goalPeriodMonths: user?.incomeGoalPeriodMonths ?? 6,
    currentStage,
    currentMilestone,
    milestoneLadder: MILESTONE_LADDER.map((m) => ({
      id: m.id,
      label: m.label,
      completed: stageOrder.indexOf(currentStage) > stageOrder.indexOf(m.stage),
    })),
  };

  const lessonByModuleSlugAndLessonSlug = new Map<string, { id: string; slug: string }>();
  for (const l of allLessons) {
    lessonByModuleSlugAndLessonSlug.set(`${l.module.slug}:${l.slug}`, { id: l.id, slug: l.slug });
  }
  const nextBestActions = NEXT_ACTION_SUGGESTIONS.slice(0, 3).map((n) => {
    const lessonId = n.moduleSlug && n.lessonSlug ? lessonByModuleSlugAndLessonSlug.get(`${n.moduleSlug}:${n.lessonSlug}`)?.id : null;
    return {
      label: n.label,
      lessonId,
      url: lessonId ? `/academy/lessons/${lessonId}` : (n.templateSlug ? `/academy/templates/${n.templateSlug}` : "/academy"),
      templateSlug: n.templateSlug ?? null,
    };
  });

  const coreModules = modules.map((mod) => {
    const completedInModule = mod.lessons.filter((l) => progressMap.get(l.id)?.completedAt).length;
    const completionPercent = mod.lessons.length ? Math.round((completedInModule / mod.lessons.length) * 100) : 0;
    const nextLessonInModule = mod.lessons.find((l) => !progressMap.get(l.id)?.completedAt);
    const category = MODULE_CATEGORY[mod.slug] ?? { icon: "📚", tagline: mod.description ?? "" };
    return {
      id: mod.id,
      slug: mod.slug,
      title: mod.title,
      description: mod.description,
      tagline: category.tagline,
      icon: category.icon,
      completionPercent,
      completedLessons: completedInModule,
      totalLessons: mod.lessons.length,
      continueLessonId: nextLessonInModule?.id ?? null,
      continueLabel: nextLessonInModule ? "Continue" : (completionPercent === 100 ? "Review" : "Start"),
    };
  });

  const insightIndex = Math.floor(Date.now() / 60000) % BUILDER_INSIGHTS.length;
  const builderInsights = [0, 1, 2].map((i) => BUILDER_INSIGHTS[(insightIndex + i) % BUILDER_INSIGHTS.length]).map((text, i) => ({ id: `insight-${i}`, text }));

  const accountability = {
    weekStart: getWeekStart(new Date()).toISOString().slice(0, 10),
    thisWeekCheckIn: thisWeekCheckIn
      ? {
          actionTaken: thisWeekCheckIn.actionTaken,
          hoursCommitted: thisWeekCheckIn.hoursCommitted,
          revenueCents: thisWeekCheckIn.revenueCents,
          notes: thisWeekCheckIn.notes ?? undefined,
        }
      : null,
    promptLabel: "Did you take action this week?",
  };

  const communityShortcut = {
    askQuestionUrl: "/community",
    joinChannelSlug: "business-beginner",
    shareProgressUrl: "/community",
  };

  const badgesMinimal = userBadges.slice(0, 6).map((ub) => ({
    id: ub.badge.id,
    slug: ub.badge.slug,
    name: ub.badge.name,
    icon: ub.badge.icon,
  }));

  res.json({
    pathwayBadge,
    progressBar,
    primaryAction,
    incomeGoal,
    nextBestActions,
    coreModules,
    builderInsights,
    templatesShortcut: TEMPLATES_SHORTCUT,
    accountability,
    communityShortcut,
    badges: badgesMinimal,
    workspaceUrl: "/workspace",
    stats: {
      overallProgressPercent: overallPercent,
      currentStreakDays: user?.academyStreakDays ?? 0,
      badgesEarned: userBadges.length,
    },
    continueLesson: continueLesson
      ? {
          id: continueLesson.id,
          slug: continueLesson.slug,
          title: continueLesson.title,
          module: continueLesson.module,
          url: `/academy/lessons/${continueLesson.id}`,
        }
      : null,
  });
});

/** GET /academy/dashboard – Amanah Wealth Academy dashboard: stats, continue, paths, recent badges (legacy; use /academy/home for new UI) */
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

/** POST /academy/check-in – weekly builder check-in (accountability) */
router.post(
  "/check-in",
  authMiddleware,
  [
    body("actionTaken").isBoolean(),
    body("hoursCommitted").optional().isInt({ min: 0, max: 168 }),
    body("revenueCents").optional().isInt({ min: 0 }),
    body("notes").optional().trim(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const userId = req.user.userId;
    const weekStart = getWeekStart(new Date());
    const { actionTaken, hoursCommitted, revenueCents, notes } = req.body as {
      actionTaken: boolean;
      hoursCommitted?: number;
      revenueCents?: number;
      notes?: string;
    };

    const checkIn = await prisma.builderCheckIn.upsert({
      where: { userId_weekStartDate: { userId, weekStartDate: weekStart } },
      create: { userId, weekStartDate: weekStart, actionTaken, hoursCommitted: hoursCommitted ?? null, revenueCents: revenueCents ?? null, notes: notes ?? null },
      update: { actionTaken, hoursCommitted: hoursCommitted ?? undefined, revenueCents: revenueCents ?? undefined, notes: notes ?? undefined },
    });

    res.json({
      id: checkIn.id,
      weekStartDate: checkIn.weekStartDate.toISOString().slice(0, 10),
      actionTaken: checkIn.actionTaken,
      hoursCommitted: checkIn.hoursCommitted,
      revenueCents: checkIn.revenueCents,
      notes: checkIn.notes ?? undefined,
    });
  }
);

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
