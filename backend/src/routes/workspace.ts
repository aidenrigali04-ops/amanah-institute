import { Router, Request, Response } from "express";
import { body, param, query } from "express-validator";
import { authMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { prisma } from "../lib/prisma.js";
import { validateRequest } from "../lib/validation.js";

const router = Router();
router.use(authMiddleware);

/** Resolve project if user has access (owner via workspace or project member) */
async function getProjectWithAccess(projectId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { userId } });
  const owned = workspace
    ? await prisma.workspaceProject.findFirst({
        where: { id: projectId, workspaceId: workspace.id },
        include: { template: true, members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } } },
      })
    : null;
  if (owned) return { project: owned, role: "owner" as const };
  const membership = await prisma.projectMember.findFirst({
    where: { projectId, userId },
    include: {
      project: {
        include: { workspace: true, template: true, members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } } },
      },
    },
  });
  if (membership) return { project: membership.project, role: membership.role as "owner" | "editor" | "viewer" };
  return null;
}

function canEdit(role: string) {
  return role === "owner" || role === "editor";
}

/** GET /workspace/home – recent projects, create options, recommended templates, collaboration */
router.get("/home", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const userId = req.user.userId;
  try {
    let workspace = await prisma.workspace.findUnique({
      where: { userId },
      include: {
        projects: { orderBy: { updatedAt: "desc" }, take: 10 },
      },
    });
    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: { userId },
        include: { projects: true },
      });
    }

    const [sharedProjects, templates] = await Promise.all([
      prisma.projectMember.findMany({
        where: { userId, role: { not: "owner" } },
        include: { project: { include: { workspace: { select: { companyName: true } } } } },
        orderBy: { joinedAt: "desc" },
        take: 5,
      }),
      prisma.workspaceTemplate.findMany({
        orderBy: { orderIndex: "asc" },
        take: 8,
      }),
    ]);

    res.json({
      recentProjects: workspace.projects.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        status: p.status,
        updatedAt: p.updatedAt.toISOString(),
      })),
      sharedWithMe: sharedProjects.map((m) => ({
        id: m.project.id,
        name: m.project.name,
        type: m.project.type,
        role: m.role,
        ownerWorkspace: m.project.workspace?.companyName ?? "Workspace",
        updatedAt: m.project.updatedAt.toISOString(),
      })),
      recommendedTemplates: templates.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        description: t.description,
        type: t.type,
      })),
    });
  } catch (err) {
    console.error("[workspace/home]", err);
    res.status(500).json({ error: "Failed to load workspace home" });
  }
}));

/** GET /workspace/templates – list all templates */
router.get("/templates", async (req: Request, res: Response): Promise<void> => {
  const templates = await prisma.workspaceTemplate.findMany({
    orderBy: { orderIndex: "asc" },
  });
  res.json({
    templates: templates.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      description: t.description,
      type: t.type,
      definition: t.definition ? (JSON.parse(t.definition) as object) : null,
    })),
  });
});

/** GET /workspace – get current user's workspace (create if missing) */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const userId = req.user.userId;

  let workspace = await prisma.workspace.findUnique({
    where: { userId },
    include: { projects: { orderBy: { updatedAt: "desc" } } },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: { userId },
      include: { projects: true },
    });
  }

  res.json({
    id: workspace.id,
    companyName: workspace.companyName,
    logoUrl: workspace.logoUrl,
    brandingSettings: workspace.brandingSettings ? (JSON.parse(workspace.brandingSettings) as object) : null,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    projects: workspace.projects.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      status: p.status,
      metadata: p.metadata ? (JSON.parse(p.metadata) as object) : null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
  });
});

/** PATCH /workspace – update workspace (company name, logo, branding) */
router.patch(
  "/",
  [
    body("companyName").optional().isString().trim(),
    body("logoUrl").optional().isString().trim(),
    body("brandingSettings").optional().isObject(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (!validateRequest(req, res)) return;
    if (!req.user) return;
    const userId = req.user.userId;

    let workspace = await prisma.workspace.findUnique({ where: { userId } });
    if (!workspace) {
      workspace = await prisma.workspace.create({ data: { userId } });
    }

    const updates: { companyName?: string; logoUrl?: string; brandingSettings?: string } = {};
    if (req.body.companyName !== undefined) updates.companyName = req.body.companyName;
    if (req.body.logoUrl !== undefined) updates.logoUrl = req.body.logoUrl;
    if (req.body.brandingSettings !== undefined) {
      updates.brandingSettings = JSON.stringify(req.body.brandingSettings);
    }

    const updated = await prisma.workspace.update({
      where: { id: workspace.id },
      data: updates,
      include: { projects: true },
    });

    res.json({
      id: updated.id,
      companyName: updated.companyName,
      logoUrl: updated.logoUrl,
      brandingSettings: updated.brandingSettings ? (JSON.parse(updated.brandingSettings) as object) : null,
      projects: updated.projects.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        status: p.status,
      })),
    });
  }
);

const projectTypes = ["canvas", "logo", "ad_campaign", "branding", "mockup", "branding_board", "business_model", "marketing_funnel", "workflow_map"];

/** GET /workspace/projects – list projects (owned + shared) */
router.get("/projects", async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const userId = req.user.userId;

  const workspace = await prisma.workspace.findUnique({
    where: { userId },
    include: { projects: { orderBy: { updatedAt: "desc" } } },
  });

  const shared = await prisma.projectMember.findMany({
    where: { userId },
    include: { project: true },
  });

  res.json({
    projects: [
      ...(workspace?.projects ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        status: p.status,
        metadata: p.metadata ? (JSON.parse(p.metadata) as object) : null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        role: "owner" as const,
      })),
      ...shared.filter((m) => !workspace?.projects.some((p) => p.id === m.project.id)).map((m) => ({
        id: m.project.id,
        name: m.project.name,
        type: m.project.type,
        status: m.project.status,
        metadata: m.project.metadata ? (JSON.parse(m.project.metadata) as object) : null,
        createdAt: m.project.createdAt,
        updatedAt: m.project.updatedAt,
        role: m.role as "editor" | "viewer",
      })),
    ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
  });
});

/** POST /workspace/projects – create project (optional templateId) */
router.post(
  "/projects",
  [
    body("name").isString().trim().notEmpty(),
    body("type").isIn(projectTypes),
    body("templateId").optional().isString().trim(),
    body("metadata").optional().isObject(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (!validateRequest(req, res)) return;
    if (!req.user) return;
    const userId = req.user.userId;

    let workspace = await prisma.workspace.findUnique({ where: { userId } });
    if (!workspace) {
      workspace = await prisma.workspace.create({ data: { userId } });
    }

    const { name, type, templateId, metadata } = req.body as { name: string; type: string; templateId?: string; metadata?: object };
    const project = await prisma.workspaceProject.create({
      data: {
        workspaceId: workspace.id,
        name,
        type,
        templateId: templateId || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    await prisma.projectMember.create({
      data: { projectId: project.id, userId, role: "owner" },
    });

    res.status(201).json({
      id: project.id,
      name: project.name,
      type: project.type,
      status: project.status,
      templateId: project.templateId,
      metadata: project.metadata ? (JSON.parse(project.metadata) as object) : null,
      createdAt: project.createdAt,
    });
  }
);

/** GET /workspace/projects/:projectId – get single project */
router.get(
  "/projects/:projectId",
  param("projectId").isString().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    if (!validateRequest(req, res)) return;
    if (!req.user) return;
    const access = await getProjectWithAccess(req.params.projectId, req.user.userId);
    if (!access) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const { project } = access;
    res.json({
      id: project.id,
      name: project.name,
      type: project.type,
      status: project.status,
      templateId: project.templateId,
      metadata: project.metadata ? (JSON.parse(project.metadata) as object) : null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      members: project.members?.map((m) => ({
        userId: m.userId,
        role: m.role,
        firstName: m.user?.firstName,
        lastName: m.user?.lastName,
        email: m.user?.email,
      })),
    });
  }
);

/** PATCH /workspace/projects/:projectId – update project */
router.patch(
  "/projects/:projectId",
  param("projectId").isString().notEmpty(),
  [body("name").optional().isString().trim(), body("status").optional().isIn(["draft", "in_progress", "completed"]), body("metadata").optional().isObject()],
  async (req: Request, res: Response): Promise<void> => {
    if (!validateRequest(req, res)) return;
    if (!req.user) return;
    const access = await getProjectWithAccess(req.params.projectId, req.user.userId);
    if (!access || !canEdit(access.role)) {
      res.status(404).json({ error: "Project not found or access denied" });
      return;
    }
    const updates: { name?: string; status?: string; metadata?: string } = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.status !== undefined) updates.status = req.body.status;
    if (req.body.metadata !== undefined) updates.metadata = JSON.stringify(req.body.metadata);

    const updated = await prisma.workspaceProject.update({
      where: { id: req.params.projectId },
      data: updates,
    });

    res.json({
      id: updated.id,
      name: updated.name,
      type: updated.type,
      status: updated.status,
      metadata: updated.metadata ? (JSON.parse(updated.metadata) as object) : null,
      updatedAt: updated.updatedAt,
    });
  }
);

/** DELETE /workspace/projects/:projectId */
router.delete(
  "/projects/:projectId",
  param("projectId").isString().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) return;
    const access = await getProjectWithAccess(req.params.projectId, req.user.userId);
    if (!access || access.role !== "owner") {
      res.status(404).json({ error: "Project not found or only owner can delete" });
      return;
    }
    await prisma.workspaceProject.delete({ where: { id: req.params.projectId } });
    res.status(204).send();
  }
);

// ─── Canvas elements ─────────────────────────────────────────────────────────
/** GET /workspace/projects/:projectId/canvas */
router.get(
  "/projects/:projectId/canvas",
  param("projectId").isString().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) return;
    const access = await getProjectWithAccess(req.params.projectId, req.user.userId);
    if (!access) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const elements = await prisma.canvasElement.findMany({
      where: { projectId: req.params.projectId },
      orderBy: [{ zIndex: "asc" }, { createdAt: "asc" }],
    });
    res.json({
      elements: elements.map((e) => ({
        id: e.id,
        type: e.type,
        xPosition: e.xPosition,
        yPosition: e.yPosition,
        width: e.width,
        height: e.height,
        rotation: e.rotation,
        zIndex: e.zIndex,
        content: e.content ? (JSON.parse(e.content) as object) : null,
        frameId: e.frameId,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      })),
    });
  }
);

/** POST /workspace/projects/:projectId/canvas */
router.post(
  "/projects/:projectId/canvas",
  param("projectId").isString().notEmpty(),
  [
    body("type").isIn(["text", "shape", "image", "sticky", "frame"]),
    body("xPosition").isFloat(),
    body("yPosition").isFloat(),
    body("width").optional().isFloat(),
    body("height").optional().isFloat(),
    body("rotation").optional().isFloat(),
    body("zIndex").optional().isInt(),
    body("content").optional(),
    body("frameId").optional().isString(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (!validateRequest(req, res)) return;
    if (!req.user) return;
    const access = await getProjectWithAccess(req.params.projectId, req.user.userId);
    if (!access || !canEdit(access.role)) {
      res.status(404).json({ error: "Project not found or access denied" });
      return;
    }
    const { type, xPosition, yPosition, width, height, rotation, zIndex, content, frameId } = req.body;
    const el = await prisma.canvasElement.create({
      data: {
        projectId: req.params.projectId,
        type,
        xPosition: Number(xPosition),
        yPosition: Number(yPosition),
        width: width != null ? Number(width) : 100,
        height: height != null ? Number(height) : 100,
        rotation: rotation != null ? Number(rotation) : 0,
        zIndex: zIndex != null ? Number(zIndex) : 0,
        content: content != null ? JSON.stringify(content) : null,
        frameId: frameId || null,
      },
    });
    res.status(201).json({
      id: el.id,
      type: el.type,
      xPosition: el.xPosition,
      yPosition: el.yPosition,
      width: el.width,
      height: el.height,
      rotation: el.rotation,
      zIndex: el.zIndex,
      content: el.content ? (JSON.parse(el.content) as object) : null,
      frameId: el.frameId,
      createdAt: el.createdAt,
      updatedAt: el.updatedAt,
    });
  }
);

/** PATCH /workspace/projects/:projectId/canvas/:elementId */
router.patch(
  "/projects/:projectId/canvas/:elementId",
  param("projectId").isString().notEmpty(),
  param("elementId").isString().notEmpty(),
  [
    body("xPosition").optional().isFloat(),
    body("yPosition").optional().isFloat(),
    body("width").optional().isFloat(),
    body("height").optional().isFloat(),
    body("rotation").optional().isFloat(),
    body("zIndex").optional().isInt(),
    body("content").optional(),
    body("frameId").optional().isString(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (!validateRequest(req, res)) return;
    if (!req.user) return;
    const access = await getProjectWithAccess(req.params.projectId, req.user.userId);
    if (!access || !canEdit(access.role)) {
      res.status(404).json({ error: "Project not found or access denied" });
      return;
    }
    const existing = await prisma.canvasElement.findFirst({
      where: { id: req.params.elementId, projectId: req.params.projectId },
    });
    if (!existing) {
      res.status(404).json({ error: "Element not found" });
      return;
    }
    const data: Record<string, unknown> = {};
    if (req.body.xPosition !== undefined) data.xPosition = Number(req.body.xPosition);
    if (req.body.yPosition !== undefined) data.yPosition = Number(req.body.yPosition);
    if (req.body.width !== undefined) data.width = Number(req.body.width);
    if (req.body.height !== undefined) data.height = Number(req.body.height);
    if (req.body.rotation !== undefined) data.rotation = Number(req.body.rotation);
    if (req.body.zIndex !== undefined) data.zIndex = Number(req.body.zIndex);
    if (req.body.content !== undefined) data.content = typeof req.body.content === "object" ? JSON.stringify(req.body.content) : String(req.body.content);
    if (req.body.frameId !== undefined) data.frameId = req.body.frameId || null;
    const updated = await prisma.canvasElement.update({
      where: { id: req.params.elementId },
      data: data as Parameters<typeof prisma.canvasElement.update>[0]["data"],
    });
    res.json({
      id: updated.id,
      type: updated.type,
      xPosition: updated.xPosition,
      yPosition: updated.yPosition,
      width: updated.width,
      height: updated.height,
      rotation: updated.rotation,
      zIndex: updated.zIndex,
      content: updated.content ? (JSON.parse(updated.content) as object) : null,
      frameId: updated.frameId,
      updatedAt: updated.updatedAt,
    });
  }
);

/** DELETE /workspace/projects/:projectId/canvas/:elementId */
router.delete(
  "/projects/:projectId/canvas/:elementId",
  param("projectId").isString().notEmpty(),
  param("elementId").isString().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) return;
    const access = await getProjectWithAccess(req.params.projectId, req.user.userId);
    if (!access || !canEdit(access.role)) {
      res.status(404).json({ error: "Project not found or access denied" });
      return;
    }
    await prisma.canvasElement.deleteMany({
      where: { id: req.params.elementId, projectId: req.params.projectId },
    });
    res.status(204).send();
  }
);

// ─── Assets ────────────────────────────────────────────────────────────────
/** GET /workspace/projects/:projectId/assets */
router.get(
  "/projects/:projectId/assets",
  param("projectId").isString().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) return;
    const access = await getProjectWithAccess(req.params.projectId, req.user.userId);
    if (!access) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const assets = await prisma.projectAsset.findMany({
      where: { projectId: req.params.projectId },
    });
    res.json({
      assets: assets.map((a) => ({
        id: a.id,
        type: a.type,
        name: a.name,
        url: a.url,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        folderPath: a.folderPath,
        createdAt: a.createdAt,
      })),
    });
  }
);

/** POST /workspace/projects/:projectId/assets */
router.post(
  "/projects/:projectId/assets",
  param("projectId").isString().notEmpty(),
  [
    body("type").isIn(["image", "document", "video", "link"]),
    body("name").isString().trim().notEmpty(),
    body("url").isString().trim().notEmpty(),
    body("mimeType").optional().isString(),
    body("sizeBytes").optional().isInt(),
    body("folderPath").optional().isString(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (!validateRequest(req, res)) return;
    if (!req.user) return;
    const access = await getProjectWithAccess(req.params.projectId, req.user.userId);
    if (!access || !canEdit(access.role)) {
      res.status(404).json({ error: "Project not found or access denied" });
      return;
    }
    const { type, name, url, mimeType, sizeBytes, folderPath } = req.body;
    const asset = await prisma.projectAsset.create({
      data: {
        projectId: req.params.projectId,
        type,
        name,
        url,
        mimeType: mimeType || null,
        sizeBytes: sizeBytes ?? null,
        folderPath: folderPath || null,
      },
    });
    res.status(201).json({
      id: asset.id,
      type: asset.type,
      name: asset.name,
      url: asset.url,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      folderPath: asset.folderPath,
      createdAt: asset.createdAt,
    });
  }
);

/** DELETE /workspace/projects/:projectId/assets/:assetId */
router.delete(
  "/projects/:projectId/assets/:assetId",
  param("projectId").isString().notEmpty(),
  param("assetId").isString().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) return;
    const access = await getProjectWithAccess(req.params.projectId, req.user.userId);
    if (!access || !canEdit(access.role)) {
      res.status(404).json({ error: "Project not found or access denied" });
      return;
    }
    await prisma.projectAsset.deleteMany({
      where: { id: req.params.assetId, projectId: req.params.projectId },
    });
    res.status(204).send();
  }
);

// ─── Workflow (nodes + connections) ─────────────────────────────────────────
/** GET /workspace/projects/:projectId/workflows */
router.get(
  "/projects/:projectId/workflows",
  param("projectId").isString().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) return;
    const access = await getProjectWithAccess(req.params.projectId, req.user.userId);
    if (!access) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const [nodes, connections] = await Promise.all([
      prisma.workflowNode.findMany({ where: { projectId: req.params.projectId } }),
      prisma.workflowConnection.findMany({
        where: { projectId: req.params.projectId },
        include: { fromNode: true, toNode: true },
      }),
    ]);
    res.json({
      nodes: nodes.map((n) => ({
        id: n.id,
        nodeType: n.nodeType,
        config: n.config ? (JSON.parse(n.config) as object) : null,
        positionX: n.positionX,
        positionY: n.positionY,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
      connections: connections.map((c) => ({
        id: c.id,
        fromNodeId: c.fromNodeId,
        toNodeId: c.toNodeId,
      })),
    });
  }
);

/** POST /workspace/projects/:projectId/workflows/nodes */
router.post(
  "/projects/:projectId/workflows/nodes",
  param("projectId").isString().notEmpty(),
  [
    body("nodeType").isIn(["trigger", "condition", "action"]),
    body("config").optional(),
    body("positionX").optional().isFloat(),
    body("positionY").optional().isFloat(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (!validateRequest(req, res)) return;
    if (!req.user) return;
    const access = await getProjectWithAccess(req.params.projectId, req.user.userId);
    if (!access || !canEdit(access.role)) {
      res.status(404).json({ error: "Project not found or access denied" });
      return;
    }
    const { nodeType, config, positionX, positionY } = req.body;
    const node = await prisma.workflowNode.create({
      data: {
        projectId: req.params.projectId,
        nodeType,
        config: config != null ? JSON.stringify(config) : null,
        positionX: positionX != null ? Number(positionX) : 0,
        positionY: positionY != null ? Number(positionY) : 0,
      },
    });
    res.status(201).json({
      id: node.id,
      nodeType: node.nodeType,
      config: node.config ? (JSON.parse(node.config) as object) : null,
      positionX: node.positionX,
      positionY: node.positionY,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    });
  }
);

/** POST /workspace/projects/:projectId/workflows/connections */
router.post(
  "/projects/:projectId/workflows/connections",
  param("projectId").isString().notEmpty(),
  [body("fromNodeId").isString().notEmpty(), body("toNodeId").isString().notEmpty()],
  async (req: Request, res: Response): Promise<void> => {
    if (!validateRequest(req, res)) return;
    if (!req.user) return;
    const access = await getProjectWithAccess(req.params.projectId, req.user.userId);
    if (!access || !canEdit(access.role)) {
      res.status(404).json({ error: "Project not found or access denied" });
      return;
    }
    const { fromNodeId, toNodeId } = req.body;
    const conn = await prisma.workflowConnection.create({
      data: {
        projectId: req.params.projectId,
        fromNodeId,
        toNodeId,
      },
    });
    res.status(201).json({ id: conn.id, fromNodeId: conn.fromNodeId, toNodeId: conn.toNodeId });
  }
);

// ─── Notes ─────────────────────────────────────────────────────────────────
/** GET /workspace/projects/:projectId/notes */
router.get(
  "/projects/:projectId/notes",
  param("projectId").isString().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) return;
    const access = await getProjectWithAccess(req.params.projectId, req.user.userId);
    if (!access) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const notes = await prisma.projectNote.findMany({
      where: { projectId: req.params.projectId },
      include: { createdByUser: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { updatedAt: "desc" },
    });
    res.json({
      notes: notes.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        createdBy: n.createdBy,
        author: n.createdByUser
          ? { id: n.createdByUser.id, firstName: n.createdByUser.firstName, lastName: n.createdByUser.lastName }
          : null,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
    });
  }
);

/** POST /workspace/projects/:projectId/notes */
router.post(
  "/projects/:projectId/notes",
  param("projectId").isString().notEmpty(),
  [body("title").isString().trim().notEmpty(), body("body").isString()],
  async (req: Request, res: Response): Promise<void> => {
    if (!validateRequest(req, res)) return;
    if (!req.user) return;
    const access = await getProjectWithAccess(req.params.projectId, req.user.userId);
    if (!access || !canEdit(access.role)) {
      res.status(404).json({ error: "Project not found or access denied" });
      return;
    }
    const { title, body } = req.body;
    const note = await prisma.projectNote.create({
      data: {
        projectId: req.params.projectId,
        title,
        body: body ?? "",
        createdBy: req.user.userId,
      },
      include: { createdByUser: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.status(201).json({
      id: note.id,
      title: note.title,
      body: note.body,
      createdBy: note.createdBy,
      author: note.createdByUser
        ? { id: note.createdByUser.id, firstName: note.createdByUser.firstName, lastName: note.createdByUser.lastName }
        : null,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    });
  }
);

/** PATCH /workspace/projects/:projectId/notes/:noteId */
router.patch(
  "/projects/:projectId/notes/:noteId",
  param("projectId").isString().notEmpty(),
  param("noteId").isString().notEmpty(),
  [body("title").optional().isString().trim(), body("body").optional().isString()],
  async (req: Request, res: Response): Promise<void> => {
    if (!validateRequest(req, res)) return;
    if (!req.user) return;
    const access = await getProjectWithAccess(req.params.projectId, req.user.userId);
    if (!access || !canEdit(access.role)) {
      res.status(404).json({ error: "Project not found or access denied" });
      return;
    }
    const updates: { title?: string; body?: string } = {};
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.body !== undefined) updates.body = req.body.body;
    const note = await prisma.projectNote.updateMany({
      where: { id: req.params.noteId, projectId: req.params.projectId },
      data: updates,
    });
    if (note.count === 0) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    const updated = await prisma.projectNote.findUniqueOrThrow({
      where: { id: req.params.noteId },
      include: { createdByUser: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json({
      id: updated.id,
      title: updated.title,
      body: updated.body,
      createdBy: updated.createdBy,
      author: updated.createdByUser
        ? { id: updated.createdByUser.id, firstName: updated.createdByUser.firstName, lastName: updated.createdByUser.lastName }
        : null,
      updatedAt: updated.updatedAt,
    });
  }
);

/** DELETE /workspace/projects/:projectId/notes/:noteId */
router.delete(
  "/projects/:projectId/notes/:noteId",
  param("projectId").isString().notEmpty(),
  param("noteId").isString().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) return;
    const access = await getProjectWithAccess(req.params.projectId, req.user.userId);
    if (!access || !canEdit(access.role)) {
      res.status(404).json({ error: "Project not found or access denied" });
      return;
    }
    await prisma.projectNote.deleteMany({
      where: { id: req.params.noteId, projectId: req.params.projectId },
    });
    res.status(204).send();
  }
);

// ─── Project members (collaboration) ───────────────────────────────────────
/** GET /workspace/projects/:projectId/members */
router.get(
  "/projects/:projectId/members",
  param("projectId").isString().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) return;
    const access = await getProjectWithAccess(req.params.projectId, req.user.userId);
    if (!access) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const members = await prisma.projectMember.findMany({
      where: { projectId: req.params.projectId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    res.json({
      members: members.map((m) => ({
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
    });
  }
);

export default router;
