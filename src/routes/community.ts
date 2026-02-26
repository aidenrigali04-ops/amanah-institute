import { Router, Request, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import { authMiddleware } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

/** GET /community/channels – list channels */
router.get("/channels", async (_req: Request, res: Response): Promise<void> => {
  const channels = await prisma.communityChannel.findMany({
    orderBy: { orderIndex: "asc" },
    select: { id: true, slug: true, name: true, description: true, type: true, level: true },
  });
  res.json({ channels });
});

/** GET /community/channels/:channelId/posts – list posts in channel */
router.get(
  "/channels/:channelId/posts",
  param("channelId").isString(),
  query("limit").optional().isInt({ min: 1, max: 50 }).toInt(),
  query("cursor").optional().isString(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const { channelId } = req.params;
    const limit = Number(req.query.limit) || 20;
    const cursor = req.query.cursor as string | undefined;

    const channel = await prisma.communityChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    const posts = await prisma.communityPost.findMany({
      where: { channelId, status: "visible" },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { replies: true } },
      },
    });

    const nextCursor = posts.length > limit ? posts[limit - 1]?.id : null;
    const items = posts.slice(0, limit);
    res.json({
      posts: items.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        isPinned: p.isPinned,
        isLocked: p.isLocked,
        createdAt: p.createdAt,
        author: p.user,
        replyCount: p._count.replies,
      })),
      nextCursor,
    });
  }
);

/** POST /community/channels/:channelId/posts – create post (auth required) */
router.post(
  "/channels/:channelId/posts",
  authMiddleware,
  param("channelId").isString(),
  body("title").optional().isString(),
  body("body").isString().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const { channelId } = req.params;
    const { title, body } = req.body as { title?: string; body: string };

    const channel = await prisma.communityChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    const post = await prisma.communityPost.create({
      data: {
        channelId,
        userId: req.user.userId,
        title: title || null,
        body,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.status(201).json(post);
  }
);

/** GET /community/posts/:postId – single post with replies */
router.get(
  "/posts/:postId",
  param("postId").isString(),
  async (req: Request, res: Response): Promise<void> => {
    const { postId } = req.params;
    const post = await prisma.communityPost.findUnique({
      where: { id: postId, status: "visible" },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        channel: { select: { id: true, slug: true, name: true } },
        replies: {
          orderBy: { createdAt: "asc" },
          where: { status: "visible" },
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    res.json(post);
  }
);

/** POST /community/posts/:postId/replies – add reply */
router.post(
  "/posts/:postId/replies",
  authMiddleware,
  param("postId").isString(),
  body("body").isString().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const { postId } = req.params;
    const { body: bodyText } = req.body as { body: string };

    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { id: true, isLocked: true },
    });
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    if (post.isLocked) {
      res.status(403).json({ error: "Post is locked" });
      return;
    }

    const reply = await prisma.communityReply.create({
      data: {
        postId,
        userId: req.user.userId,
        body: bodyText,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.status(201).json(reply);
  }
);

export default router;
