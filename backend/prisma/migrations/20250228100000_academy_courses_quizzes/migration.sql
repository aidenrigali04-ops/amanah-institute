-- Academy: Learning paths, courses, quizzes, course progress
CREATE TABLE "LearningPath" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningPath_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LearningPath_slug_key" ON "LearningPath"("slug");
CREATE INDEX "LearningPath_order_index_idx" ON "LearningPath"("order_index");

CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "pathway_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "estimated_minutes" INTEGER,
    "skill_level" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Course_pathway_id_slug_key" ON "Course"("pathway_id", "slug");
CREATE INDEX "Course_pathway_id_idx" ON "Course"("pathway_id");

ALTER TABLE "AcademyModule" ADD COLUMN "course_id" TEXT;
CREATE INDEX "AcademyModule_course_id_idx" ON "AcademyModule"("course_id");
ALTER TABLE "AcademyModule" ADD CONSTRAINT "AcademyModule_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AcademyLesson" ADD COLUMN "key_takeaways" TEXT;
ALTER TABLE "AcademyLesson" ADD COLUMN "workspace_task_label" TEXT;
ALTER TABLE "AcademyLesson" ADD COLUMN "workspace_template_slug" TEXT;
ALTER TABLE "AcademyLesson" ADD COLUMN "discussion_channel_slug" TEXT;

CREATE TABLE "LessonQuiz" (
    "id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonQuiz_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LessonQuiz_lesson_id_key" ON "LessonQuiz"("lesson_id");

CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "correct_index" INTEGER NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QuizQuestion_quiz_id_idx" ON "QuizQuestion"("quiz_id");

CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QuizAttempt_user_id_idx" ON "QuizAttempt"("user_id");
CREATE INDEX "QuizAttempt_lesson_id_idx" ON "QuizAttempt"("lesson_id");

CREATE TABLE "CourseProgress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "completion_percent" INTEGER NOT NULL DEFAULT 0,
    "last_lesson_id" TEXT,
    "last_activity_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CourseProgress_user_id_course_id_key" ON "CourseProgress"("user_id", "course_id");
CREATE INDEX "CourseProgress_user_id_idx" ON "CourseProgress"("user_id");
CREATE INDEX "CourseProgress_course_id_idx" ON "CourseProgress"("course_id");

ALTER TABLE "User" ADD COLUMN "primary_pathway_id" TEXT;

ALTER TABLE "Course" ADD CONSTRAINT "Course_pathway_id_fkey" FOREIGN KEY ("pathway_id") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonQuiz" ADD CONSTRAINT "LessonQuiz_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "AcademyLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "LessonQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "AcademyLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseProgress" ADD CONSTRAINT "CourseProgress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseProgress" ADD CONSTRAINT "CourseProgress_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
