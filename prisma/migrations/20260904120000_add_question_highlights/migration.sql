-- CreateTable
CREATE TABLE "QuestionHighlight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "context" "QuestionFlagContext" NOT NULL,
    "contextId" TEXT NOT NULL,
    "textRoot" TEXT NOT NULL,
    "start" INTEGER NOT NULL,
    "end" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'yellow',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionHighlight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionHighlight_userId_questionId_context_contextId_idx" ON "QuestionHighlight"("userId", "questionId", "context", "contextId");

-- AddForeignKey
ALTER TABLE "QuestionHighlight" ADD CONSTRAINT "QuestionHighlight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionHighlight" ADD CONSTRAINT "QuestionHighlight_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;