import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface GuildMessageDto {
  id: string;
  guildId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: Date;
}

@Injectable()
export class GuildChatService {
  private readonly logger = new Logger(GuildChatService.name);

  constructor(private prisma: PrismaService) {}

  // ============================================
  // GET GUILD MESSAGES (members only)
  // ============================================
  async getGuildMessages(userId: string, guildId: string, limit = 50): Promise<GuildMessageDto[]> {
    await this.assertMember(userId, guildId);

    const messages = await this.prisma.guildMessage.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { sender: { select: { id: true, firstName: true, lastName: true } } },
    });

    return messages.reverse().map((m) => ({
      id: m.id,
      guildId: m.guildId,
      senderId: m.senderId,
      senderName: `${m.sender.firstName || ''} ${m.sender.lastName || ''}`.trim() || 'Anonymous',
      content: m.content,
      createdAt: m.createdAt,
    }));
  }

  // ============================================
  // SEND A GUILD MESSAGE
  // ============================================
  async sendGuildMessage(userId: string, guildId: string, content: string): Promise<GuildMessageDto> {
    if (!content.trim()) {
      throw new BadRequestException('Message cannot be empty.');
    }
    await this.assertMember(userId, guildId);

    const message = await this.prisma.guildMessage.create({
      data: { guildId, senderId: userId, content: content.trim() },
      include: { sender: { select: { id: true, firstName: true, lastName: true } } },
    });

    return {
      id: message.id,
      guildId: message.guildId,
      senderId: message.senderId,
      senderName: `${message.sender.firstName || ''} ${message.sender.lastName || ''}`.trim() || 'Anonymous',
      content: message.content,
      createdAt: message.createdAt,
    };
  }

  // ============================================
  // HELPER: ensure the user is a guild member
  // ============================================
  private async assertMember(userId: string, guildId: string): Promise<void> {
    const membership = await this.prisma.arenaGuildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
    if (!membership) {
      throw new BadRequestException('You are not a member of this guild.');
    }
  }
}