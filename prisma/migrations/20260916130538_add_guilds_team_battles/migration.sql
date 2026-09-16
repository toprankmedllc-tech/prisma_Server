-- AlterTable
ALTER TABLE "ArenaGuild" ADD COLUMN     "leaderId" TEXT,
ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ArenaGuildMember" ADD COLUMN     "inCompetitionSquad" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ArenaGuildVote" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaGuildVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaTeamBattle" (
    "id" TEXT NOT NULL,
    "teamAId" TEXT NOT NULL,
    "teamBId" TEXT NOT NULL,
    "status" "ArenaBattleStatus" NOT NULL DEFAULT 'PENDING',
    "durationSec" INTEGER NOT NULL DEFAULT 300,
    "teamAScore" INTEGER NOT NULL DEFAULT 0,
    "teamBScore" INTEGER NOT NULL DEFAULT 0,
    "winnerTeamId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArenaTeamBattle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaTeamBattleMember" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaTeamBattleMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaTeamBattleQuestion" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ArenaTeamBattleQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaTeamBattleAnswer" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "selectedChoiceId" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "timeSpentSec" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaTeamBattleAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArenaGuildVote_guildId_idx" ON "ArenaGuildVote"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaGuildVote_guildId_voterId_key" ON "ArenaGuildVote"("guildId", "voterId");

-- CreateIndex
CREATE INDEX "ArenaTeamBattle_teamAId_idx" ON "ArenaTeamBattle"("teamAId");

-- CreateIndex
CREATE INDEX "ArenaTeamBattle_teamBId_idx" ON "ArenaTeamBattle"("teamBId");

-- CreateIndex
CREATE INDEX "ArenaTeamBattle_status_idx" ON "ArenaTeamBattle"("status");

-- CreateIndex
CREATE INDEX "ArenaTeamBattleMember_battleId_idx" ON "ArenaTeamBattleMember"("battleId");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaTeamBattleMember_battleId_userId_key" ON "ArenaTeamBattleMember"("battleId", "userId");

-- CreateIndex
CREATE INDEX "ArenaTeamBattleQuestion_battleId_idx" ON "ArenaTeamBattleQuestion"("battleId");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaTeamBattleQuestion_battleId_questionId_key" ON "ArenaTeamBattleQuestion"("battleId", "questionId");

-- CreateIndex
CREATE INDEX "ArenaTeamBattleAnswer_battleId_idx" ON "ArenaTeamBattleAnswer"("battleId");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaTeamBattleAnswer_battleId_questionId_userId_key" ON "ArenaTeamBattleAnswer"("battleId", "questionId", "userId");

-- AddForeignKey
ALTER TABLE "ArenaGuildVote" ADD CONSTRAINT "ArenaGuildVote_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "ArenaGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaGuildVote" ADD CONSTRAINT "ArenaGuildVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaGuildVote" ADD CONSTRAINT "ArenaGuildVote_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaTeamBattleMember" ADD CONSTRAINT "ArenaTeamBattleMember_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "ArenaTeamBattle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaTeamBattleMember" ADD CONSTRAINT "ArenaTeamBattleMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaTeamBattleQuestion" ADD CONSTRAINT "ArenaTeamBattleQuestion_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "ArenaTeamBattle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaTeamBattleQuestion" ADD CONSTRAINT "ArenaTeamBattleQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaTeamBattleAnswer" ADD CONSTRAINT "ArenaTeamBattleAnswer_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "ArenaTeamBattle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaTeamBattleAnswer" ADD CONSTRAINT "ArenaTeamBattleAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaTeamBattleAnswer" ADD CONSTRAINT "ArenaTeamBattleAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
