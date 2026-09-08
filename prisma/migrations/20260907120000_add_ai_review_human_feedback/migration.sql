-- AlterTable
ALTER TABLE "ai_reviews" ADD COLUMN "humanComment" TEXT,
ADD COLUMN "humanAgree" BOOLEAN,
ADD COLUMN "humanReviewedBy" TEXT,
ADD COLUMN "humanReviewedAt" TIMESTAMP(3),
ADD COLUMN "verificationVerdict" TEXT,
ADD COLUMN "verificationAgrees" BOOLEAN,
ADD COLUMN "verificationConfidence" INTEGER,
ADD COLUMN "verificationReason" TEXT;