-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "reviewNotes" JSONB,
ADD COLUMN     "reviewed" BOOLEAN NOT NULL DEFAULT false;

