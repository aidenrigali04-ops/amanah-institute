-- Academy home dashboard: pathway, income goal, stage, milestone, builder check-in
ALTER TABLE "User" ADD COLUMN "pathway" TEXT;
ALTER TABLE "User" ADD COLUMN "income_goal_monthly_cents" INTEGER;
ALTER TABLE "User" ADD COLUMN "income_goal_period_months" INTEGER;
ALTER TABLE "User" ADD COLUMN "current_stage" TEXT;
ALTER TABLE "User" ADD COLUMN "current_milestone" TEXT;

CREATE TABLE "BuilderCheckIn" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_start_date" TIMESTAMP(3) NOT NULL,
    "action_taken" BOOLEAN NOT NULL,
    "hours_committed" INTEGER,
    "revenue_cents" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderCheckIn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BuilderCheckIn_user_id_week_start_date_key" ON "BuilderCheckIn"("user_id", "week_start_date");
CREATE INDEX "BuilderCheckIn_user_id_idx" ON "BuilderCheckIn"("user_id");

ALTER TABLE "BuilderCheckIn" ADD CONSTRAINT "BuilderCheckIn_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
