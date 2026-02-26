import { Router, Request, Response } from "express";
import { body, param, validationResult } from "express-validator";
import { authMiddleware } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();
router.use(authMiddleware);

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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
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

/** GET /workspace/projects – list projects (logo, ad_campaign, branding, mockup) */
router.get("/projects", async (req: Request, res: Response): Promise<void> => {
  if (!req.user) return;
  const userId = req.user.userId;

  const workspace = await prisma.workspace.findUnique({
    where: { userId },
    include: { projects: { orderBy: { updatedAt: "desc" } } },
  });

  if (!workspace) {
    res.json({ projects: [] });
    return;
  }

  res.json({
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

/** POST /workspace/projects – create project (logo | ad_campaign | branding | mockup) */
router.post(
  "/projects",
  [
    body("name").isString().trim().notEmpty(),
    body("type").isIn(["logo", "ad_campaign", "branding", "mockup"]),
    body("metadata").optional().isObject(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const userId = req.user.userId;

    let workspace = await prisma.workspace.findUnique({ where: { userId } });
    if (!workspace) {
      workspace = await prisma.workspace.create({ data: { userId } });
    }

    const { name, type, metadata } = req.body as { name: string; type: string; metadata?: object };
    const project = await prisma.workspaceProject.create({
      data: {
        workspaceId: workspace.id,
        name,
        type,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    res.status(201).json({
      id: project.id,
      name: project.name,
      type: project.type,
      status: project.status,
      metadata: project.metadata ? (JSON.parse(project.metadata) as object) : null,
      createdAt: project.createdAt,
    });
  }
);

/** GET /workspace/projects/:projectId – get single project (for full-screen workspace) */
router.get(
  "/projects/:projectId",
  param("projectId").isString().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const userId = req.user.userId;
    const projectId = req.params.projectId;

    const workspace = await prisma.workspace.findUnique({ where: { userId } });
    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const project = await prisma.workspaceProject.findFirst({
      where: { id: projectId, workspaceId: workspace.id },
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.json({
      id: project.id,
      name: project.name,
      type: project.type,
      status: project.status,
      metadata: project.metadata ? (JSON.parse(project.metadata) as object) : null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  }
);

/** PATCH /workspace/projects/:projectId – update project */
router.patch(
  "/projects/:projectId",
  param("projectId").isString().notEmpty(),
  body("name").optional().isString().trim(),
  body("status").optional().isIn(["draft", "in_progress", "completed"]),
  body("metadata").optional().isObject(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const userId = req.user.userId;
    const projectId = req.params.projectId;

    const workspace = await prisma.workspace.findUnique({ where: { userId } });
    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const existing = await prisma.workspaceProject.findFirst({
      where: { id: projectId, workspaceId: workspace.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const updates: { name?: string; status?: string; metadata?: string } = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.status !== undefined) updates.status = req.body.status;
    if (req.body.metadata !== undefined) updates.metadata = JSON.stringify(req.body.metadata);

    const updated = await prisma.workspaceProject.update({
      where: { id: projectId },
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

/** DELETE /workspace/projects/:projectId – delete project */
router.delete(
  "/projects/:projectId",
  param("projectId").isString().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) return;
    const userId = req.user.userId;
    const projectId = req.params.projectId;

    const workspace = await prisma.workspace.findUnique({ where: { userId } });
    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const project = await prisma.workspaceProject.findFirst({
      where: { id: projectId, workspaceId: workspace.id },
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    await prisma.workspaceProject.delete({ where: { id: projectId } });
    res.status(204).send();
  }
);

export default router;
