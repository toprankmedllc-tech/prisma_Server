-- Student-owned mock exam configuration and block-by-block attempt lifecycle
CREATE TYPE "ExamMode" AS ENUM ('ADMIN', 'STUDENT_MOCK');
CREATE TYPE "ExamAttemptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

ALTER TABLE "Exam"
  ADD COLUMN "mode" "ExamMode" NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN "createdById" TEXT;

ALTER TABLE "ExamAttempt"
  ALTER COLUMN "score" SET DEFAULT 0,
  ALTER COLUMN "questionAttempts" SET DEFAULT '[]',
  ADD COLUMN "correctAnswers" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "answeredQuestions" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "currentBlock" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "status" "ExamAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  ADD COLUMN "blockStartedAt" TIMESTAMP(3);

UPDATE "ExamAttempt"
SET "questionAttempts" = '[]'
WHERE "questionAttempts" IS NULL;

ALTER TABLE "ExamAttempt"
  ALTER COLUMN "questionAttempts" SET NOT NULL;

CREATE INDEX "ExamAttempt_userId_status_idx" ON "ExamAttempt"("userId", "status");

ALTER TABLE "Exam"
  ADD CONSTRAINT "Exam_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
