import { Router, Request, Response } from "express";
import { body, param } from "express-validator";
import { authMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { prisma } from "../lib/prisma.js";
import { validateRequest } from "../lib/validation.js";
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

/** GET /academy/dashboard – 7-section academy dashboard (Continue, Pathway Progress, Recommended Course, Workspace Task, Weekly Quiz, Community, Tool Updates) */
router.get("/dashboard", authMiddleware, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const userId = req.user.userId;
  try {
  const [modules, progressList, userBadges, user, allLessons, pathways, courseProgressList, toolReleases] = await Promise.all([
    prisma.academyModule.findMany({
      orderBy: { orderIndex: "asc" },
      include: {
        lessons: { orderBy: { orderIndex: "asc" }, select: { id: true, slug: true, title: true, durationMinutes: true, orderIndex: true, workspaceTaskLabel: true, workspaceTemplateSlug: true } },
        course: { select: { id: true, title: true, slug: true } },
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
      select: { academyStreakDays: true, primaryPathwayId: true },
    }),
    prisma.academyLesson.findMany({
      orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
      include: { module: { select: { slug: true, title: true } } },
    }),
    prisma.learningPath.findMany({ orderBy: { orderIndex: "asc" }, include: { courses: { orderBy: { orderIndex: "asc" }, select: { id: true, slug: true, title: true } } } }),
    prisma.courseProgress.findMany({ where: { userId }, select: { courseId: true, completionPercent: true } }),
    prisma.toolRelease.findMany({ orderBy: { releasedAt: "desc" }, take: 5, select: { id: true, name: true, description: true, url: true } }),
  ]);

  const progressMap = new Map(progressList.map((p) => [p.lessonId, p]));
  const continueLesson = allLessons.find((l) => !progressMap.get(l.id)?.completedAt);
  const totalLessons = modules.reduce((s, m) => s + m.lessons.length, 0);
  const completedLessons = progressList.filter((p) => p.completedAt).length;
  const overallPercent = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const primaryPathway = user?.primaryPathwayId ? pathways.find((p) => p.id === user.primaryPathwayId) : pathways[0];
  const pathwayCourses = primaryPathway?.courses ?? [];
  const courseProgressMap = new Map(courseProgressList.map((cp) => [cp.courseId, cp]));
  const coursesCompleted = pathwayCourses.filter((c) => (courseProgressMap.get(c.id)?.completionPercent ?? 0) >= 100).length;
  const pathPercent = pathwayCourses.length ? Math.round((coursesCompleted / pathwayCourses.length) * 100) : overallPercent;
  const nextCourseInPath = pathwayCourses.find((c) => (courseProgressMap.get(c.id)?.completionPercent ?? 0) < 100);

  type LessonWithTask = { id: string; title: string; workspaceTaskLabel: string | null; workspaceTemplateSlug: string | null };
  const lessonWithTask = ((): LessonWithTask | null => {
    for (const m of modules) {
      const found = m.lessons.find((l) => (l as LessonWithTask).workspaceTaskLabel);
      if (found) return found as LessonWithTask;
    }
    return null;
  })();
  const workspaceTask = lessonWithTask?.workspaceTaskLabel
    ? {
        label: lessonWithTask.workspaceTaskLabel,
        lessonTitle: lessonWithTask.title,
        openWorkspaceUrl: lessonWithTask.workspaceTemplateSlug ? `/workspace?template=${lessonWithTask.workspaceTemplateSlug}` : "/workspace",
      }
    : null;

  const continueModule = continueLesson ? modules.find((m) => m.slug === continueLesson.module?.slug) : null;
  const continueCourseTitle = continueModule?.course?.title ?? continueLesson?.module?.title ?? null;

  res.json({
    continueLearning: continueLesson
      ? {
          course: continueCourseTitle,
          module: continueLesson.module?.title,
          lesson: continueLesson.title,
          progress: progressMap.get(continueLesson.id)?.progressPercent ?? 0,
          resumeUrl: `/academy/lessons/${continueLesson.id}`,
        }
      : null,
    pathwayProgress: {
      pathwayName: primaryPathway?.name ?? "Academy",
      coursesCompleted,
      coursesTotal: pathwayCourses.length || 1,
      pathPercent,
      nextMilestone: nextCourseInPath ? `Complete ${nextCourseInPath.title}` : "Complete pathway",
    },
    recommendedNextCourse: nextCourseInPath
      ? { id: nextCourseInPath.id, title: nextCourseInPath.title, reason: "Next in your pathway", startUrl: `/academy/course/${nextCourseInPath.id}` }
      : null,
    workspaceTask,
    weeklyKnowledgeTest: { questionCount: 5, estimatedMinutes: 2, startUrl: "/academy/test" },
    communityDiscussions: { askUrl: "/community", joinUrl: "/community", previewTitle: "Discuss your strategy" },
    toolUpdates: { items: toolReleases.map((t) => ({ name: t.name, description: t.description, url: t.url })) },
    stats: {
      overallProgressPercent: overallPercent,
      currentStreakDays: user?.academyStreakDays ?? 0,
      badgesEarned: userBadges.length,
    },
    learningPaths: modules.map((mod) => ({
      id: mod.id,
      slug: mod.slug,
      title: mod.title,
      description: mod.description,
      completedLessons: mod.lessons.filter((l) => progressMap.get(l.id)?.completedAt).length,
      totalLessons: mod.lessons.length,
      lessons: mod.lessons.map((l) => ({
        id: l.id,
        slug: l.slug,
        title: l.title,
        durationMinutes: l.durationMinutes,
        orderIndex: l.orderIndex,
        progress: progressMap.get(l.id)?.progressPercent ?? 0,
        completedAt: progressMap.get(l.id)?.completedAt ?? null,
      })),
    })),
    recentBadges: userBadges.map((ub) => ({ ...ub.badge, earnedAt: ub.earnedAt })),
  });
  } catch (err) {
    console.error("[academy/dashboard]", err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
}));

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
    if (!validateRequest(req, res)) return;
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
    if (!validateRequest(req, res)) return;
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
    if (!validateRequest(req, res)) return;
    if (!req.user) return;
    const { lessonId } = req.params;
    const { progressPercent, completed } = req.body as { progressPercent?: number; completed?: boolean };
    const userId = req.user.userId;

    const lesson = await prisma.academyLesson.findUnique({
      where: { id: lessonId },
      include: { module: { select: { courseId: true } } },
    });
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

    if (lesson.module?.courseId && (completedAt || percent === 100)) {
      const courseId = lesson.module.courseId;
      const courseLessons = await prisma.academyLesson.findMany({
        where: { module: { courseId } },
        select: { id: true },
      });
      const completedInCourse = await prisma.academyProgress.count({
        where: { userId, lessonId: { in: courseLessons.map((l) => l.id) }, completedAt: { not: null } },
      });
      const completionPercent = courseLessons.length ? Math.round((completedInCourse / courseLessons.length) * 100) : 0;
      await prisma.courseProgress.upsert({
        where: { userId_courseId: { userId, courseId } },
        create: { userId, courseId, completionPercent, lastLessonId: lessonId, lastActivityAt: new Date() },
        update: { completionPercent, lastLessonId: lessonId, lastActivityAt: new Date() },
      });
    }

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
    if (!validateRequest(req, res)) return;
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

/** GET /academy/courses – list courses (optionally by pathway); includes user progress */
router.get("/courses", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const userId = req.user.userId;
  const pathwaySlug = req.query.pathway as string | undefined;

  const pathways = await prisma.learningPath.findMany({
    where: pathwaySlug ? { slug: pathwaySlug } : undefined,
    orderBy: { orderIndex: "asc" },
    include: {
      courses: {
        orderBy: { orderIndex: "asc" },
        include: { _count: { select: { modules: true } } },
      },
    },
  });
  const courseIds = pathways.flatMap((p) => p.courses.map((c) => c.id));
  const progressList = courseIds.length
    ? await prisma.courseProgress.findMany({ where: { userId, courseId: { in: courseIds } }, select: { courseId: true, completionPercent: true, lastLessonId: true } })
    : [];
  const progressMap = new Map(progressList.map((p) => [p.courseId, p]));

  const courses = pathways.flatMap((p) =>
    p.courses.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      description: c.description,
      pathwayName: p.name,
      pathwaySlug: p.slug,
      moduleCount: c._count.modules,
      estimatedMinutes: c.estimatedMinutes,
      skillLevel: c.skillLevel,
      completionPercent: progressMap.get(c.id)?.completionPercent ?? 0,
    }))
  );

  res.json({ courses, pathways: pathways.map((p) => ({ id: p.id, slug: p.slug, name: p.name, description: p.description })) });
});

/** GET /academy/course/:id – course detail with modules and lessons; user progress */
router.get(
  "/course/:id",
  authMiddleware,
  param("id").isString().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    if (!validateRequest(req, res)) return;
    if (!req.user) return;
    const userId = req.user.userId;
    const courseId = req.params.id;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        pathway: { select: { id: true, slug: true, name: true } },
        modules: {
          orderBy: { orderIndex: "asc" },
          include: {
            lessons: { orderBy: { orderIndex: "asc" }, select: { id: true, slug: true, title: true, durationMinutes: true, orderIndex: true } },
          },
        },
      },
    });
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const progressList = lessonIds.length ? await prisma.academyProgress.findMany({ where: { userId, lessonId: { in: lessonIds } }, select: { lessonId: true, progressPercent: true, completedAt: true } }) : [];
    const progressMap = new Map(progressList.map((p) => [p.lessonId, p]));
    const courseProgress = await prisma.courseProgress.findUnique({ where: { userId_courseId: { userId, courseId } } });

    res.json({
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
      estimatedMinutes: course.estimatedMinutes,
      skillLevel: course.skillLevel,
      pathway: course.pathway,
      modules: course.modules.map((m) => ({
        id: m.id,
        slug: m.slug,
        title: m.title,
        description: m.description,
        lessons: m.lessons.map((l) => ({
          ...l,
          progress: progressMap.get(l.id)?.progressPercent ?? 0,
          completedAt: progressMap.get(l.id)?.completedAt ?? null,
        })),
        completedLessons: m.lessons.filter((l) => progressMap.get(l.id)?.completedAt).length,
        totalLessons: m.lessons.length,
      })),
      completionPercent: courseProgress?.completionPercent ?? 0,
      lastLessonId: courseProgress?.lastLessonId ?? null,
    });
  }
);

/** GET /academy/progress – user progress summary (courses, overall) */
router.get("/progress", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const userId = req.user.userId;

  const [lessonProgress, courseProgress, pathways] = await Promise.all([
    prisma.academyProgress.findMany({ where: { userId }, select: { lessonId: true, progressPercent: true, completedAt: true } }),
    prisma.courseProgress.findMany({ where: { userId }, include: { course: { select: { id: true, title: true, slug: true } } } }),
    prisma.learningPath.findMany({ orderBy: { orderIndex: "asc" }, select: { id: true, slug: true, name: true } }),
  ]);

  const totalLessons = await prisma.academyLesson.count();
  const completedLessons = lessonProgress.filter((p) => p.completedAt).length;
  const overallPercent = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;

  res.json({
    overallPercent,
    completedLessons,
    totalLessons,
    courseProgress: courseProgress.map((cp) => ({
      courseId: cp.course.id,
      title: cp.course.title,
      slug: cp.course.slug,
      completionPercent: cp.completionPercent,
    })),
    pathways,
  });
});

/** GET /academy/lessons/:lessonId/quiz – get quiz for lesson (questions without correct answer) */
router.get(
  "/lessons/:lessonId/quiz",
  authMiddleware,
  param("lessonId").isString().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    if (!validateRequest(req, res)) return;
    const lessonId = req.params.lessonId;
    const quiz = await prisma.lessonQuiz.findUnique({
      where: { lessonId },
      include: { questions: { orderBy: { orderIndex: "asc" } } },
    });
    if (!quiz) {
      res.json({ questions: [] });
      return;
    }
    const questions = quiz.questions.map((q) => {
      const options = JSON.parse(q.options) as string[];
      return { id: q.id, questionText: q.questionText, options };
    });
    res.json({ quizId: quiz.id, questions });
  }
);

/** POST /academy/lessons/:lessonId/quiz/attempt – submit quiz attempt */
router.post(
  "/lessons/:lessonId/quiz/attempt",
  authMiddleware,
  param("lessonId").isString().notEmpty(),
  body("answers").isObject(),
  async (req: Request, res: Response): Promise<void> => {
    if (!validateRequest(req, res)) return;
    if (!req.user) return;
    const userId = req.user.userId;
    const lessonId = req.params.lessonId;
    const answers = req.body.answers as Record<string, number>;

    const quiz = await prisma.lessonQuiz.findUnique({
      where: { lessonId },
      include: { questions: true },
    });
    if (!quiz) {
      res.status(404).json({ error: "No quiz for this lesson" });
      return;
    }
    let correct = 0;
    for (const q of quiz.questions) {
      const selected = answers[q.id];
      if (typeof selected === "number" && selected === q.correctIndex) correct++;
    }
    const score = quiz.questions.length ? Math.round((correct / quiz.questions.length) * 100) : 0;
    const passed = score >= 70;

    await prisma.quizAttempt.create({
      data: { userId, lessonId, score, passed, answers: JSON.stringify(answers) },
    });

    res.json({ score, passed, correct, total: quiz.questions.length });
  }
);

export default router;
