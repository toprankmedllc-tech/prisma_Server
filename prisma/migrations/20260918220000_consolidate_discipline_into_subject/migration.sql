-- The Discipline table was already dropped in a previous migration.
-- We just need to re-point Question.disciplineId to Subject.

-- First, add a temporary column to hold the new FK
ALTER TABLE "Question" ADD COLUMN "newDisciplineId" TEXT;

-- Map existing disciplineId values to Subject IDs by matching names.
-- Since Discipline was populated from the same data as Subject, we match by name.
-- But since Discipline table is gone, we need to use the discipline name stored
-- in the Question's disciplineId reference. Since the FK is broken, we need
-- to use a different approach: match by the discipline name that was stored.

-- Actually, since the Discipline table is gone and the FK is broken,
-- we need to recreate the mapping. Let's check if we can still access
-- the disciplineId values (they're just strings, the FK constraint is broken
-- but the values are still there).

-- We need to get the discipline names. Since Discipline table is gone,
-- we'll use the fact that the disciplineId values were UUIDs from the
-- Discipline table. We can't recover the names from UUIDs alone.

-- Instead, let's use a different approach: since we know the migration
-- that created Discipline populated it from Question.discipline (the old
-- string column), and we already dropped that column, we need to
-- reconstruct the mapping.

-- Actually, the previous migration already linked questions to Discipline
-- by name. Since Discipline is gone, let's just set disciplineId to NULL
-- and re-link based on the Subject table (which has the same names).

-- Set all disciplineId to NULL first (the FK to Discipline is broken anyway)
UPDATE "Question" SET "disciplineId" = NULL WHERE "disciplineId" IS NOT NULL;

-- Drop the old FK constraint (it references the now-deleted Discipline table)
ALTER TABLE "Question" DROP CONSTRAINT IF EXISTS "Question_disciplineId_fkey";

-- Drop the old disciplineId column
ALTER TABLE "Question" DROP COLUMN "disciplineId";

-- Add the new disciplineId column
ALTER TABLE "Question" ADD COLUMN "disciplineId" TEXT;

-- Re-link questions to Subject based on the topic's subject
-- (since discipline and subject were populated from the same source data)
UPDATE "Question" q
SET "disciplineId" = t."subjectId"
FROM "Topic" t
WHERE q."topicId" = t.id;

-- Add the new FK constraint pointing to Subject
ALTER TABLE "Question" ADD CONSTRAINT "Question_disciplineId_fkey"
    FOREIGN KEY ("disciplineId") REFERENCES "Subject"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Create index
CREATE INDEX "Question_disciplineId_idx" ON "Question"("disciplineId");
