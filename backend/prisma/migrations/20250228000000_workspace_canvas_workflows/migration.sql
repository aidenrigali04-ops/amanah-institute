-- Workspace: templates, project members, canvas, assets, workflows, notes
CREATE TABLE "WorkspaceTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceTemplate_slug_key" ON "WorkspaceTemplate"("slug");
CREATE INDEX "WorkspaceTemplate_type_idx" ON "WorkspaceTemplate"("type");

ALTER TABLE "WorkspaceProject" ADD COLUMN "template_id" TEXT;

CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CanvasElement" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x_position" DOUBLE PRECISION NOT NULL,
    "y_position" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "z_index" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT,
    "frame_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasElement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectAsset" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "folder_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowNode" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "node_type" TEXT NOT NULL,
    "config" TEXT,
    "position_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position_y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowNode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowConnection" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "from_node_id" TEXT NOT NULL,
    "to_node_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectNote" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectMember_project_id_user_id_key" ON "ProjectMember"("project_id", "user_id");
CREATE INDEX "ProjectMember_project_id_idx" ON "ProjectMember"("project_id");
CREATE INDEX "ProjectMember_user_id_idx" ON "ProjectMember"("user_id");

CREATE INDEX "CanvasElement_project_id_idx" ON "CanvasElement"("project_id");
CREATE INDEX "CanvasElement_frame_id_idx" ON "CanvasElement"("frame_id");

CREATE INDEX "ProjectAsset_project_id_idx" ON "ProjectAsset"("project_id");

CREATE INDEX "WorkflowNode_project_id_idx" ON "WorkflowNode"("project_id");

CREATE UNIQUE INDEX "WorkflowConnection_from_node_id_to_node_id_key" ON "WorkflowConnection"("from_node_id", "to_node_id");
CREATE INDEX "WorkflowConnection_project_id_idx" ON "WorkflowConnection"("project_id");

CREATE INDEX "ProjectNote_project_id_idx" ON "ProjectNote"("project_id");

ALTER TABLE "WorkspaceProject" ADD CONSTRAINT "WorkspaceProject_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "WorkspaceTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "WorkspaceProject_template_id_idx" ON "WorkspaceProject"("template_id");

ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "WorkspaceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CanvasElement" ADD CONSTRAINT "CanvasElement_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "WorkspaceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectAsset" ADD CONSTRAINT "ProjectAsset_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "WorkspaceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowNode" ADD CONSTRAINT "WorkflowNode_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "WorkspaceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowConnection" ADD CONSTRAINT "WorkflowConnection_from_node_id_fkey" FOREIGN KEY ("from_node_id") REFERENCES "WorkflowNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowConnection" ADD CONSTRAINT "WorkflowConnection_to_node_id_fkey" FOREIGN KEY ("to_node_id") REFERENCES "WorkflowNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectNote" ADD CONSTRAINT "ProjectNote_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "WorkspaceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectNote" ADD CONSTRAINT "ProjectNote_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
