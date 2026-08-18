-- Preserve every AI review attempt instead of enforcing one review per question.
DROP INDEX IF EXISTS "ai_reviews_questionId_key";

-- CreateEnum
CREATE TYPE "AiReviewTrigger" AS ENUM (
    'MANUAL',
    'AUTOMATIC',
    'RE_REVIEW',
    'AFTER_HUMAN_REJECTION',
    'AFTER_EDIT',
    'AFTER_AI_CORRECTION'
);

-- CreateEnum
CREATE TYPE "QuestionRevisionType" AS ENUM (
    'ORIGINAL',
    'HUMAN_EDIT',
    'AI_REPLACEMENT',
    'AI_CORRECTION',
    'MANUAL_CORRECTION'
);

-- Add audit fields to AI reviews.
ALTER TABLE "ai_reviews"
    ADD COLUMN "revisionId" TEXT,
    ADD COLUMN "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "trigger" "AiReviewTrigger" NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN "promptVersion" TEXT NOT NULL DEFAULT 'v1',
    ADD COLUMN "humanRejectionContext" JSONB,
    ADD COLUMN "criticalIssues" JSONB,
    ADD COLUMN "humanAiAgreement" BOOLEAN;

-- Add original/replacement linkage to questions.
ALTER TABLE "Question"
    ADD COLUMN "originalQuestionId" TEXT;

-- Create immutable question revision snapshots.
CREATE TABLE "QuestionRevision" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "revisionType" "QuestionRevisionType" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionRevision_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "QuestionRevision_questionId_revisionNumber_key"
    ON "QuestionRevision"("questionId", "revisionNumber");
CREATE INDEX "QuestionRevision_questionId_createdAt_idx"
    ON "QuestionRevision"("questionId", "createdAt");
CREATE INDEX "ai_reviews_questionId_createdAt_idx"
    ON "ai_reviews"("questionId", "createdAt");

-- Foreign keys
ALTER TABLE "ai_reviews"
    ADD CONSTRAINT "ai_reviews_revisionId_fkey"
    FOREIGN KEY ("revisionId") REFERENCES "QuestionRevision"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QuestionRevision"
    ADD CONSTRAINT "QuestionRevision_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Question"
    ADD CONSTRAINT "Question_originalQuestionId_fkey"
    FOREIGN KEY ("originalQuestionId") REFERENCES "Question"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
