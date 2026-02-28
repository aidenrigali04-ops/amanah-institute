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

// ─── DMs and Collab (1-on-1 and joint chat) – auth required ─────────────────

/** GET /community/conversations – list conversations (DM + collab) for current user */
router.get("/conversations", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const participants = await prisma.conversationParticipant.findMany({
    where: { userId: req.user.userId },
    include: {
      conversation: {
        include: {
          participants: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
          messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, createdAt: true } },
        },
      },
    },
    orderBy: { conversation: { updatedAt: "desc" } },
  });
  const list = participants.map((p) => {
    const c = p.conversation;
    const otherParticipants = c.participants.filter((x) => x.userId !== req.user!.userId);
    return {
      id: c.id,
      type: c.type,
      name: c.name,
      participants: c.participants.map((x) => ({ id: x.user.id, firstName: x.user.firstName, lastName: x.user.lastName })),
      otherParticipants: otherParticipants.map((x) => ({ id: x.user.id, firstName: x.user.firstName, lastName: x.user.lastName })),
      lastMessage: c.messages[0] ?? null,
      updatedAt: c.updatedAt,
    };
  });
  res.json({ conversations: list });
});

/** POST /community/conversations – start DM (otherUserId) or create collab room (name, type=collab) */
router.post(
  "/conversations",
  authMiddleware,
  body("type").isIn(["dm", "collab"]),
  body("otherUserId").optional().isString(),
  body("name").optional().trim(),
  body("participantIds").optional().isArray(),
  body("participantIds.*").optional().isString(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const userId = req.user.userId;
    const { type, otherUserId, name, participantIds } = req.body as {
      type: "dm" | "collab";
      otherUserId?: string;
      name?: string;
      participantIds?: string[];
    };
    if (type === "dm") {
      if (!otherUserId || otherUserId === userId) {
        res.status(400).json({ error: "otherUserId required and must differ from current user" });
        return;
      }
      const myConvs = await prisma.conversationParticipant.findMany({
        where: { userId, conversation: { type: "dm" } },
        include: { conversation: { include: { participants: true } } },
      });
      const existing = myConvs.find((p) => {
        const ids = p.conversation.participants.map((x) => x.userId);
        return ids.length === 2 && ids.includes(userId) && ids.includes(otherUserId);
      });
      let conv = existing
        ? await prisma.conversation.findUnique({
            where: { id: existing.conversationId },
            include: { participants: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
          })
        : null;
      if (!conv) {
        conv = await prisma.conversation.create({
          data: {
            type: "dm",
            participants: {
              create: [{ userId }, { userId: otherUserId }],
            },
          },
          include: { participants: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
        });
      }
      res.status(201).json(conv);
      return;
    }
    if (type === "collab") {
      const ids = [...(participantIds ?? []), userId].filter((id, i, a) => a.indexOf(id) === i);
      const conv = await prisma.conversation.create({
        data: {
          type: "collab",
          name: name ?? "Collab room",
          participants: { create: ids.map((id) => ({ userId: id })) },
        },
        include: { participants: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
      });
      res.status(201).json(conv);
    }
  }
);

/** GET /community/conversations/:conversationId – get conversation with messages (paginated) */
router.get(
  "/conversations/:conversationId",
  authMiddleware,
  param("conversationId").isString(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("cursor").optional().isString(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const { conversationId } = req.params;
    const limit = Number(req.query.limit) || 50;
    const cursor = req.query.cursor as string | undefined;
    const participant = await prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: req.user.userId },
    });
    if (!participant) {
      res.status(404).json({ error: "Conversation not found or access denied" });
      return;
    }
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: limit + 1,
          ...(cursor && { cursor: { id: cursor }, skip: 1 }),
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const msgs = conversation.messages;
    const nextCursor = msgs.length > limit ? msgs[limit - 1]?.id : null;
    res.json({
      ...conversation,
      messages: msgs.slice(0, limit).reverse(),
      nextCursor,
    });
  }
);

/** POST /community/conversations/:conversationId/messages – send message */
router.post(
  "/conversations/:conversationId/messages",
  authMiddleware,
  param("conversationId").isString(),
  body("body").isString().notEmpty().trim(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const { conversationId } = req.params;
    const { body: bodyText } = req.body as { body: string };
    const participant = await prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: req.user.userId },
    });
    if (!participant) {
      res.status(404).json({ error: "Conversation not found or access denied" });
      return;
    }
    const message = await prisma.conversationMessage.create({
      data: { conversationId, userId: req.user.userId, body: bodyText },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    res.status(201).json(message);
  }
);

/** POST /community/conversations/:conversationId/participants – add participant (collab only) */
router.post(
  "/conversations/:conversationId/participants",
  authMiddleware,
  param("conversationId").isString(),
  body("userId").isString(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const { conversationId } = req.params;
    const { userId: newUserId } = req.body as { userId: string };
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });
    if (!conv || conv.type !== "collab") {
      res.status(404).json({ error: "Collab conversation not found" });
      return;
    }
    const isParticipant = conv.participants.some((p) => p.userId === req.user!.userId);
    if (!isParticipant) {
      res.status(403).json({ error: "Only participants can add members" });
      return;
    }
    const existing = conv.participants.find((p) => p.userId === newUserId);
    if (existing) {
      res.status(400).json({ error: "User already in conversation" });
      return;
    }
    await prisma.conversationParticipant.create({
      data: { conversationId, userId: newUserId },
    });
    res.status(201).json({ added: true, userId: newUserId });
  }
);

export default router;
