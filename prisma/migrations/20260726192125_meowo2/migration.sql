-- AlterTable
ALTER TABLE "users" ADD COLUMN     "reviewedQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "skippedQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[];
