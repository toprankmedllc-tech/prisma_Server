-- Rename subjectId to disciplineId in Topic table
ALTER TABLE "Topic" RENAME COLUMN "subjectId" TO "disciplineId";

-- Drop old FK constraint and add new one pointing to Discipline table
ALTER TABLE "Topic" DROP CONSTRAINT IF EXISTS "Topic_subjectId_fkey";
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_disciplineId_fkey" 
  FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rename subjectId to disciplineId in StudySession table
ALTER TABLE "StudySession" RENAME COLUMN "subjectId" TO "disciplineId";

-- Drop old FK constraint and add new one pointing to Discipline table
ALTER TABLE "StudySession" DROP CONSTRAINT IF EXISTS "StudySession_subjectId_fkey";
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_disciplineId_fkey" 
  FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
