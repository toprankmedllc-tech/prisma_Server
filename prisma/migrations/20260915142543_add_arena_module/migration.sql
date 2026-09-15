-- CreateEnum
CREATE TYPE "ArenaBattleStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ArenaBattleMode" AS ENUM ('HEAD_TO_HEAD', 'RAPID_FIRE');

-- CreateEnum
CREATE TYPE "ArenaGuildRole" AS ENUM ('LEADER', 'MEMBER');

-- DropIndex
DROP INDEX "ai_reviews_questionId_createdAt_idx";

-- AlterTable
ALTER TABLE "ExamAttempt" ALTER COLUMN "startedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "ArenaBattle" (
    "id" TEXT NOT NULL,
    "player1Id" TEXT NOT NULL,
    "player2Id" TEXT NOT NULL,
    "mode" "ArenaBattleMode" NOT NULL DEFAULT 'HEAD_TO_HEAD',
    "status" "ArenaBattleStatus" NOT NULL DEFAULT 'PENDING',
    "player1Score" INTEGER NOT NULL DEFAULT 0,
    "player2Score" INTEGER NOT NULL DEFAULT 0,
    "player1Answered" INTEGER NOT NULL DEFAULT 0,
    "player2Answered" INTEGER NOT NULL DEFAULT 0,
    "winnerId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArenaBattle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaBattleQuestion" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ArenaBattleQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaBattleAnswer" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "selectedChoiceId" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "timeSpentSec" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaBattleAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaLeaderboardEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArenaLeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaGuild" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArenaGuild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaGuildMember" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ArenaGuildRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaGuildMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArenaBattle_player1Id_idx" ON "ArenaBattle"("player1Id");

-- CreateIndex
CREATE INDEX "ArenaBattle_player2Id_idx" ON "ArenaBattle"("player2Id");

-- CreateIndex
CREATE INDEX "ArenaBattle_status_idx" ON "ArenaBattle"("status");

-- CreateIndex
CREATE INDEX "ArenaBattleQuestion_battleId_idx" ON "ArenaBattleQuestion"("battleId");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaBattleQuestion_battleId_questionId_key" ON "ArenaBattleQuestion"("battleId", "questionId");

-- CreateIndex
CREATE INDEX "ArenaBattleAnswer_battleId_idx" ON "ArenaBattleAnswer"("battleId");

-- CreateIndex
CREATE INDEX "ArenaBattleAnswer_userId_idx" ON "ArenaBattleAnswer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaBattleAnswer_battleId_questionId_userId_key" ON "ArenaBattleAnswer"("battleId", "questionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaLeaderboardEntry_userId_key" ON "ArenaLeaderboardEntry"("userId");

-- CreateIndex
CREATE INDEX "ArenaLeaderboardEntry_points_idx" ON "ArenaLeaderboardEntry"("points");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaGuild_name_key" ON "ArenaGuild"("name");

-- CreateIndex
CREATE INDEX "ArenaGuildMember_userId_idx" ON "ArenaGuildMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaGuildMember_guildId_userId_key" ON "ArenaGuildMember"("guildId", "userId");

-- AddForeignKey
ALTER TABLE "ArenaBattle" ADD CONSTRAINT "ArenaBattle_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaBattle" ADD CONSTRAINT "ArenaBattle_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaBattleQuestion" ADD CONSTRAINT "ArenaBattleQuestion_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "ArenaBattle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaBattleQuestion" ADD CONSTRAINT "ArenaBattleQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaBattleAnswer" ADD CONSTRAINT "ArenaBattleAnswer_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "ArenaBattle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaBattleAnswer" ADD CONSTRAINT "ArenaBattleAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaBattleAnswer" ADD CONSTRAINT "ArenaBattleAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaLeaderboardEntry" ADD CONSTRAINT "ArenaLeaderboardEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaGuildMember" ADD CONSTRAINT "ArenaGuildMember_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "ArenaGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaGuildMember" ADD CONSTRAINT "ArenaGuildMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
