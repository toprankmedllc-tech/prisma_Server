-- Persist the currently active mock-exam question and its server-side start time.
ALTER TABLE "ExamAttempt"
ADD COLUMN "activeQuestionId" TEXT,
ADD COLUMN "activeQuestionStartedAt" TIMESTAMP(3);
