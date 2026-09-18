-- Create OrganSystem table
CREATE TABLE "OrganSystem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganSystem_pkey" PRIMARY KEY ("id")
);

-- Create Discipline table
CREATE TABLE "Discipline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Discipline_pkey" PRIMARY KEY ("id")
);

-- Add unique constraints
CREATE UNIQUE INDEX "OrganSystem_name_key" ON "OrganSystem"("name");
CREATE UNIQUE INDEX "Discipline_name_key" ON "Discipline"("name");

-- Add foreign key columns to Question
ALTER TABLE "Question" ADD COLUMN "organSystemId" TEXT;
ALTER TABLE "Question" ADD COLUMN "disciplineId" TEXT;

-- Populate OrganSystem from distinct system values (normalized)
INSERT INTO "OrganSystem" ("id", "name", "description")
SELECT gen_random_uuid()::TEXT, DISTINCT_SYSTEM, NULL
FROM (
    SELECT DISTINCT INITCAP(TRIM(system)) AS DISTINCT_SYSTEM
    FROM "Question"
    WHERE system IS NOT NULL
) AS systems;

-- Populate Discipline from distinct discipline values (normalized)
INSERT INTO "Discipline" ("id", "name", "description")
SELECT gen_random_uuid()::TEXT, DISTINCT_DISCIPLINE, NULL
FROM (
    SELECT DISTINCT INITCAP(TRIM(discipline)) AS DISTINCT_DISCIPLINE
    FROM "Question"
    WHERE discipline IS NOT NULL
) AS disciplines;

-- Link existing questions to OrganSystem
UPDATE "Question" q
SET "organSystemId" = (
    SELECT os.id
    FROM "OrganSystem" os
    WHERE os.name = INITCAP(TRIM(q.system))
)
WHERE q.system IS NOT NULL;

-- Link existing questions to Discipline
UPDATE "Question" q
SET "disciplineId" = (
    SELECT d.id
    FROM "Discipline" d
    WHERE d.name = INITCAP(TRIM(q.discipline))
)
WHERE q.discipline IS NOT NULL;

-- Add foreign key constraints
ALTER TABLE "Question" ADD CONSTRAINT "Question_organSystemId_fkey" FOREIGN KEY ("organSystemId") REFERENCES "OrganSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Remove old columns
ALTER TABLE "Question" DROP COLUMN "system";
ALTER TABLE "Question" DROP COLUMN "discipline";
ALTER TABLE "Question" DROP COLUMN "subsystem";

-- Create indexes for performance
CREATE INDEX "Question_organSystemId_idx" ON "Question"("organSystemId");
CREATE INDEX "Question_disciplineId_idx" ON "Question"("disciplineId");
