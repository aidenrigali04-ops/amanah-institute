-- Dashboard: market feed, academy topics, tool releases, workspace
CREATE TABLE "MarketFeedItem" (
    "id" TEXT NOT NULL,
    "symbol" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "sentiment" TEXT NOT NULL,
    "source" TEXT,
    "url" TEXT,
    "related_symbols" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketFeedItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AcademyTopic" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "path" TEXT NOT NULL,
    "link" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademyTopic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ToolRelease" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "url" TEXT,
    "released_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolRelease_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_name" TEXT,
    "logo_url" TEXT,
    "branding_settings" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceProject" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceProject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Workspace_user_id_key" ON "Workspace"("user_id");

CREATE INDEX "MarketFeedItem_symbol_idx" ON "MarketFeedItem"("symbol");
CREATE INDEX "MarketFeedItem_published_at_idx" ON "MarketFeedItem"("published_at");
CREATE INDEX "MarketFeedItem_sentiment_idx" ON "MarketFeedItem"("sentiment");

CREATE INDEX "AcademyTopic_path_idx" ON "AcademyTopic"("path");
CREATE INDEX "AcademyTopic_published_at_idx" ON "AcademyTopic"("published_at");

CREATE INDEX "ToolRelease_released_at_idx" ON "ToolRelease"("released_at");

CREATE INDEX "WorkspaceProject_workspace_id_idx" ON "WorkspaceProject"("workspace_id");

ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceProject" ADD CONSTRAINT "WorkspaceProject_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
