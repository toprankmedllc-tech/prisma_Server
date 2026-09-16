-- CreateTable
CREATE TABLE "GuildMessage" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuildMessage_guildId_createdAt_idx" ON "GuildMessage"("guildId", "createdAt");

-- AddForeignKey
ALTER TABLE "GuildMessage" ADD CONSTRAINT "GuildMessage_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "ArenaGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildMessage" ADD CONSTRAINT "GuildMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
