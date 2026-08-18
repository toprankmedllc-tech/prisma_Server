CREATE TABLE "StudyAnswerAttempt" (
    "id" TEXT NOT NULL,
    "sessionQuestionId" TEXT NOT NULL,
    "selectedChoiceId" TEXT,
    "isCorrect" BOOLEAN NOT NULL,
    "timeSpentSec" INTEGER NOT NULL DEFAULT 0,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudyAnswerAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudyAnswerAttempt_sessionQuestionId_attemptedAt_idx"
  ON "StudyAnswerAttempt"("sessionQuestionId", "attemptedAt");

ALTER TABLE "StudyAnswerAttempt" ADD CONSTRAINT "StudyAnswerAttempt_sessionQuestionId_fkey"
  FOREIGN KEY ("sessionQuestionId") REFERENCES "StudySessionQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
