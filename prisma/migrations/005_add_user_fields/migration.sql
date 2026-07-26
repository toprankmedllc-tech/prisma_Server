-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "StudentType" AS ENUM ('MEDICAL_GRADUATE', 'GRADUATE', 'INTERMEDIATE_GRADUATE_IMG');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "studentType" "StudentType";
ALTER TABLE "users" ADD COLUMN "targetTestDate" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "acceptedTerms" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "acceptedPrivacy" BOOLEAN NOT NULL DEFAULT false;
