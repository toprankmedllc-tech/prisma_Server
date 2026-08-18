CREATE TYPE "StudySessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

CREATE TYPE "StudySessionQuestionStatus" AS ENUM ('UNANSWERED', 'CORRECT');

CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "questionType" "QuestionSourceType",
    "difficulty" "Difficulty",
    "subjectId" TEXT,
    "status" "StudySessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudySessionQuestion" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "StudySessionQuestionStatus" NOT NULL DEFAULT 'UNANSWERED',
    "firstDisplayedAt" TIMESTAMP(3),
    "lastDisplayedAt" TIMESTAMP(3),
    "totalTimeSpentSec" INTEGER NOT NULL DEFAULT 0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "answeredAt" TIMESTAMP(3),
    CONSTRAINT "StudySessionQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudySession_userId_status_idx" ON "StudySession"("userId", "status");
CREATE UNIQUE INDEX "StudySessionQuestion_sessionId_questionId_key" ON "StudySessionQuestion"("sessionId", "questionId");
CREATE UNIQUE INDEX "StudySessionQuestion_sessionId_order_key" ON "StudySessionQuestion"("sessionId", "order");
CREATE INDEX "StudySessionQuestion_sessionId_status_idx" ON "StudySessionQuestion"("sessionId", "status");

ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudySessionQuestion" ADD CONSTRAINT "StudySessionQuestion_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudySessionQuestion" ADD CONSTRAINT "StudySessionQuestion_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
