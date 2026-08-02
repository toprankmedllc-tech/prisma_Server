/*
  Warnings:

  - Added the required column `updatedAt` to the `Exam` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "blockCount" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "questionsPerBlock" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "secondsPerQuestion" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "selectionSettings" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ExamAttempt" ADD COLUMN     "questionAttempts" JSONB;

-- AlterTable
ALTER TABLE "ExamQuestion" ADD COLUMN     "blockIndex" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ExamAttempt_examId_idx" ON "ExamAttempt"("examId");

-- CreateIndex
CREATE INDEX "ExamAttempt_userId_idx" ON "ExamAttempt"("userId");

-- CreateIndex
CREATE INDEX "ExamQuestion_examId_blockIndex_idx" ON "ExamQuestion"("examId", "blockIndex");
