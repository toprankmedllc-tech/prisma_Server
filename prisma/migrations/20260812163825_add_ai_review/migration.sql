-- CreateEnum
CREATE TYPE "AiReviewVerdict" AS ENUM ('PASS', 'FAIL');

-- CreateTable
CREATE TABLE "ai_reviews" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "verdict" "AiReviewVerdict" NOT NULL,
    "usmleStyleScore" INTEGER,
    "medicalAccuracyScore" INTEGER,
    "hallucinationRiskScore" INTEGER,
    "explanationQualityScore" INTEGER,
    "clinicalRelevanceScore" INTEGER,
    "grammaticalQualityScore" INTEGER,
    "usmleStyleFeedback" TEXT,
    "medicalAccuracyFeedback" TEXT,
    "hallucinationDetails" TEXT,
    "explanationQualityFeedback" TEXT,
    "clinicalRelevanceFeedback" TEXT,
    "grammaticalFeedback" TEXT,
    "generalFeedback" TEXT,
    "reviewedByAi" TEXT,
    "tokenUsage" INTEGER,
    "reviewDurationMs" INTEGER,
    "replacementQuestionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_reviews_questionId_key" ON "ai_reviews"("questionId");

-- AddForeignKey
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
