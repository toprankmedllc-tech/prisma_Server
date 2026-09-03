-- CreateEnum
CREATE TYPE "QuestionFlagContext" AS ENUM ('ADMIN_EXAM', 'MOCK_EXAM', 'STUDY_SESSION');

-- CreateTable
CREATE TABLE "QuestionFlag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "context" "QuestionFlagContext" NOT NULL,
    "contextId" TEXT NOT NULL,
    "isFlagged" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestionFlag_userId_questionId_context_contextId_key" ON "QuestionFlag"("userId", "questionId", "context", "contextId");

-- CreateIndex
CREATE INDEX "QuestionFlag_userId_context_contextId_idx" ON "QuestionFlag"("userId", "context", "contextId");

-- AddForeignKey
ALTER TABLE "QuestionFlag" ADD CONSTRAINT "QuestionFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionFlag" ADD CONSTRAINT "QuestionFlag_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
