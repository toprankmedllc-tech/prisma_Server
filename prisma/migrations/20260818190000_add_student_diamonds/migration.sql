-- Add initial currency for AI-generated study tips.
ALTER TABLE "users" ADD COLUMN "diamonds" INTEGER NOT NULL DEFAULT 10;
