import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatMessageDto } from './dto/social.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private prisma: PrismaService) {}

  // ============================================
  // GET A CONVERSATION BETWEEN TWO USERS
  // ============================================
  async getConversation(userId: string, otherId: string, limit = 50): Promise<ChatMessageDto[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherId },
          { senderId: otherId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.reverse().map((m) => ({
      id: m.id,
      senderId: m.senderId,
      receiverId: m.receiverId,
      content: m.content,
      readAt: m.readAt,
      createdAt: m.createdAt,
    }));
  }

  // ============================================
  // SEND A MESSAGE
  // ============================================
  async sendMessage(userId: string, receiverId: string, content: string): Promise<ChatMessageDto> {
    if (!content.trim()) {
      throw new BadRequestException('Message cannot be empty.');
    }
    if (userId === receiverId) {
      throw new BadRequestException('You cannot message yourself.');
    }

    const receiver = await this.prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) throw new NotFoundException('Receiver not found.');

    const message = await this.prisma.chatMessage.create({
      data: { senderId: userId, receiverId, content: content.trim() },
    });

    return {
      id: message.id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      content: message.content,
      readAt: message.readAt,
      createdAt: message.createdAt,
    };
  }

  // ============================================
  // MARK MESSAGES AS READ
  // ============================================
  async markRead(userId: string, otherId: string): Promise<{ message: string }> {
    await this.prisma.chatMessage.updateMany({
      where: { senderId: otherId, receiverId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { message: 'Marked as read.' };
  }

  // ============================================
  // GET UNREAD MESSAGE COUNTS PER SENDER
  // ============================================
  async getUnreadCounts(userId: string): Promise<Record<string, number>> {
    const unread = await this.prisma.chatMessage.groupBy({
      by: ['senderId'],
      where: { receiverId: userId, readAt: null },
      _count: { _all: true },
    });

    const counts: Record<string, number> = {};
    for (const row of unread) {
      counts[row.senderId] = row._count._all;
    }
    return counts;
  }

  // ============================================
  // GET TOTAL UNREAD COUNT
  // ============================================
  async getTotalUnread(userId: string): Promise<number> {
    return this.prisma.chatMessage.count({
      where: { receiverId: userId, readAt: null },
    });
  }
}