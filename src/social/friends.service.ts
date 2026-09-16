import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FriendDto, FriendRequestDto } from './dto/social.dto';

// In-memory online presence tracker (userId -> socket count).
// Populated by the SocialGateway on connect/disconnect.
export class PresenceService {
  private readonly online = new Map<string, number>();

  add(userId: string): void {
    this.online.set(userId, (this.online.get(userId) || 0) + 1);
  }

  remove(userId: string): void {
    const count = (this.online.get(userId) || 1) - 1;
    if (count <= 0) this.online.delete(userId);
    else this.online.set(userId, count);
  }

  isOnline(userId: string): boolean {
    return this.online.has(userId);
  }

  onlineUserIds(): string[] {
    return [...this.online.keys()];
  }
}

@Injectable()
export class FriendsService {
  private readonly logger = new Logger(FriendsService.name);

  constructor(
    private prisma: PrismaService,
    private presence: PresenceService,
  ) {}

  // ============================================
  // SEND A FRIEND REQUEST
  // ============================================
  async sendRequest(userId: string, addressee: string): Promise<{ message: string }> {
    if (addressee === userId) {
      throw new BadRequestException('You cannot add yourself as a friend.');
    }

    // Resolve addressee by ID or email.
    const target = await this.prisma.user.findFirst({
      where: { OR: [{ id: addressee }, { email: addressee.toLowerCase() }] },
    });
    if (!target) {
      throw new NotFoundException('User not found.');
    }

    // Check for an existing relationship in either direction.
    const existing = await this.prisma.friend.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: target.id },
          { requesterId: target.id, addresseeId: userId },
        ],
      },
    });
    if (existing) {
      if (existing.status === 'ACCEPTED') {
        throw new BadRequestException('You are already friends.');
      }
      if (existing.status === 'PENDING') {
        throw new BadRequestException('A friend request is already pending.');
      }
      // If declined, allow re-request by updating.
      await this.prisma.friend.update({
        where: { id: existing.id },
        data: { requesterId: userId, addresseeId: target.id, status: 'PENDING' },
      });
      return { message: 'Friend request sent.' };
    }

    await this.prisma.friend.create({
      data: { requesterId: userId, addresseeId: target.id, status: 'PENDING' },
    });
    return { message: 'Friend request sent.' };
  }

  // ============================================
  // ACCEPT A FRIEND REQUEST
  // ============================================
  async acceptRequest(userId: string, requestId: string): Promise<{ message: string }> {
    const request = await this.prisma.friend.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Friend request not found.');
    if (request.addresseeId !== userId) {
      throw new BadRequestException('You cannot accept this request.');
    }
    await this.prisma.friend.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED' },
    });
    return { message: 'Friend request accepted.' };
  }

  // ============================================
  // DECLINE A FRIEND REQUEST
  // ============================================
  async declineRequest(userId: string, requestId: string): Promise<{ message: string }> {
    const request = await this.prisma.friend.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Friend request not found.');
    if (request.addresseeId !== userId) {
      throw new BadRequestException('You cannot decline this request.');
    }
    await this.prisma.friend.update({
      where: { id: requestId },
      data: { status: 'DECLINED' },
    });
    return { message: 'Friend request declined.' };
  }

  // ============================================
  // LIST FRIENDS (with online status)
  // ============================================
  async listFriends(userId: string): Promise<FriendDto[]> {
    const friends = await this.prisma.friend.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        addressee: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return friends.map((f) => {
      const other = f.requesterId === userId ? f.addressee : f.requester;
      return {
        id: f.id,
        userId: other.id,
        name: `${other.firstName || ''} ${other.lastName || ''}`.trim() || 'Anonymous',
        email: other.email,
        status: f.status,
        online: this.presence.isOnline(other.id),
      };
    });
  }

  // ============================================
  // LIST INCOMING PENDING REQUESTS
  // ============================================
  async listRequests(userId: string): Promise<FriendRequestDto[]> {
    const requests = await this.prisma.friend.findMany({
      where: { addresseeId: userId, status: 'PENDING' },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((r) => ({
      id: r.id,
      requesterId: r.requesterId,
      requesterName: `${r.requester.firstName || ''} ${r.requester.lastName || ''}`.trim() || 'Anonymous',
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  // ============================================
  // REMOVE A FRIEND
  // ============================================
  async removeFriend(userId: string, friendId: string): Promise<{ message: string }> {
    const friend = await this.prisma.friend.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: userId, addresseeId: friendId },
          { requesterId: friendId, addresseeId: userId },
        ],
      },
    });
    if (!friend) throw new NotFoundException('Friend not found.');
    await this.prisma.friend.delete({ where: { id: friend.id } });
    return { message: 'Friend removed.' };
  }
}