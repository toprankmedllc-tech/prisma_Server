-- Fix the disciplineId FK to point to Subject instead of the deleted Discipline table

-- Drop the broken FK constraint (references deleted Discipline table)
ALTER TABLE "Question" DROP CONSTRAINT IF EXISTS "Question_disciplineId_fkey";

-- Clear existing disciplineId values (they reference deleted Discipline records)
UPDATE "Question" SET "disciplineId" = NULL WHERE "disciplineId" IS NOT NULL;

-- Re-link questions to Subject based on their topic's subject
UPDATE "Question" q
SET "disciplineId" = t."subjectId"
FROM "Topic" t
WHERE q."topicId" = t.id;

-- Add the new FK constraint pointing to Subject
ALTER TABLE "Question" ADD CONSTRAINT "Question_disciplineId_fkey"
    FOREIGN KEY ("disciplineId") REFERENCES "Subject"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Create index
CREATE INDEX IF NOT EXISTS "Question_disciplineId_idx" ON "Question"("disciplineId");
