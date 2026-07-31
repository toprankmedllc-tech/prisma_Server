-- AlterTable
ALTER TABLE "users" ADD COLUMN     "assignedQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "preferredSubjects" TEXT[] DEFAULT ARRAY[]::TEXT[];
