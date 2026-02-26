-- AlterTable User
ALTER TABLE "User" ADD COLUMN "theme" TEXT;
ALTER TABLE "User" ADD COLUMN "last_academy_activity_at" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "academy_streak_days" INTEGER NOT NULL DEFAULT 0;

-- AlterTable AcademyLesson
ALTER TABLE "AcademyLesson" ADD COLUMN "action_assignment_schema" TEXT;

-- AlterTable AcademyProgress
ALTER TABLE "AcademyProgress" ADD COLUMN "last_activity_at" TIMESTAMP(3);

-- CreateTable Badge
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Badge_slug_key" ON "Badge"("slug");

-- CreateTable UserBadge
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "badge_id" TEXT NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserBadge_user_id_badge_id_key" ON "UserBadge"("user_id", "badge_id");
CREATE INDEX "UserBadge_user_id_idx" ON "UserBadge"("user_id");

-- CreateTable ActionAssignmentResponse
CREATE TABLE "ActionAssignmentResponse" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "responses" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionAssignmentResponse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ActionAssignmentResponse_user_id_lesson_id_key" ON "ActionAssignmentResponse"("user_id", "lesson_id");
CREATE INDEX "ActionAssignmentResponse_user_id_idx" ON "ActionAssignmentResponse"("user_id");

-- AddForeignKey UserBadge
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey ActionAssignmentResponse
ALTER TABLE "ActionAssignmentResponse" ADD CONSTRAINT "ActionAssignmentResponse_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionAssignmentResponse" ADD CONSTRAINT "ActionAssignmentResponse_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "AcademyLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
