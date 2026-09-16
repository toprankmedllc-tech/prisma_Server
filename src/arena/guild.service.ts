import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateGuildDto,
  InviteToGuildDto,
  VoteForLeaderDto,
  SetCompetitionSquadDto,
  GuildDto,
  GuildMemberDto,
} from './dto/guild.dto';

@Injectable()
export class GuildService {
  private readonly logger = new Logger(GuildService.name);

  constructor(private prisma: PrismaService) {}

  // ============================================
  // CREATE A GUILD
  // ============================================
  async createGuild(userId: string, dto: CreateGuildDto): Promise<GuildDto> {
    // A user can only be in one guild.
    const existing = await this.prisma.arenaGuildMember.findUnique({
      where: { guildId_userId: { guildId: '', userId } },
    }).catch(() => null);
    if (existing) {
      throw new BadRequestException('You are already in a guild. Leave it first.');
    }

    const guild = await this.prisma.arenaGuild.create({
      data: {
        name: dto.name.trim(),
        description: dto.description || null,
        leaderId: userId,
        members: {
          create: { userId, role: 'LEADER' },
        },
      },
      include: { members: { include: { user: true } } },
    });

    return this.toGuildDto(guild);
  }

  // ============================================
  // GET A GUILD
  // ============================================
  async getGuild(guildId: string): Promise<GuildDto> {
    const guild = await this.prisma.arenaGuild.findUnique({
      where: { id: guildId },
      include: { members: { include: { user: true } } },
    });
    if (!guild) throw new NotFoundException(`Guild with ID "${guildId}" not found`);
    return this.toGuildDto(guild);
  }

  // ============================================
  // LIST GUILDS
  // ============================================
  async listGuilds(): Promise<GuildDto[]> {
    const guilds = await this.prisma.arenaGuild.findMany({
      orderBy: { points: 'desc' },
      include: { members: { include: { user: true } } },
    });
    return guilds.map((g) => this.toGuildDto(g));
  }

  // ============================================
  // GET MY GUILD
  // ============================================
  async getMyGuild(userId: string): Promise<GuildDto | null> {
    const membership = await this.prisma.arenaGuildMember.findFirst({
      where: { userId },
      include: { guild: { include: { members: { include: { user: true } } } } },
    });
    if (!membership) return null;
    return this.toGuildDto(membership.guild);
  }

  // ============================================
  // JOIN A GUILD
  // ============================================
  async joinGuild(userId: string, guildId: string): Promise<GuildDto> {
    const guild = await this.prisma.arenaGuild.findUnique({ where: { id: guildId } });
    if (!guild) throw new NotFoundException(`Guild with ID "${guildId}" not found`);

    const existing = await this.prisma.arenaGuildMember.findFirst({ where: { userId } });
    if (existing) throw new BadRequestException('You are already in a guild.');

    await this.prisma.arenaGuildMember.create({
      data: { guildId, userId, role: 'MEMBER' },
    });

    return this.getGuild(guildId);
  }

  // ============================================
  // LEAVE A GUILD
  // ============================================
  async leaveGuild(userId: string, guildId: string): Promise<{ message: string }> {
    const membership = await this.prisma.arenaGuildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
    if (!membership) throw new BadRequestException('You are not a member of this guild.');

    await this.prisma.arenaGuildMember.delete({ where: { id: membership.id } });

    // If the leader left, promote the next member (or delete the guild if empty).
    const guild = await this.prisma.arenaGuild.findUnique({
      where: { id: guildId },
      include: { members: { orderBy: { joinedAt: 'asc' } } },
    });
    if (guild && guild.leaderId === userId) {
      const nextLeader = guild.members[0];
      if (nextLeader) {
        await this.prisma.arenaGuild.update({
          where: { id: guildId },
          data: { leaderId: nextLeader.userId },
        });
        await this.prisma.arenaGuildMember.update({
          where: { id: nextLeader.id },
          data: { role: 'LEADER' },
        });
      } else {
        await this.prisma.arenaGuild.delete({ where: { id: guildId } });
      }
    }

    return { message: 'Left the guild.' };
  }

  // ============================================
  // INVITE TO GUILD
  // ============================================
  async inviteToGuild(userId: string, guildId: string, dto: InviteToGuildDto): Promise<{ message: string }> {
    const guild = await this.prisma.arenaGuild.findUnique({ where: { id: guildId } });
    if (!guild) throw new NotFoundException(`Guild with ID "${guildId}" not found`);
    if (guild.leaderId !== userId) {
      throw new BadRequestException('Only the guild leader can invite members.');
    }

    // Resolve invitee by ID or email.
    const invitee = await this.prisma.user.findFirst({
      where: { OR: [{ id: dto.invitee }, { email: dto.invitee }] },
    });
    if (!invitee) throw new NotFoundException('Invitee not found.');

    const existing = await this.prisma.arenaGuildMember.findFirst({ where: { userId: invitee.id } });
    if (existing) throw new BadRequestException('Invitee is already in a guild.');

    await this.prisma.arenaGuildMember.create({
      data: { guildId, userId: invitee.id, role: 'MEMBER' },
    });

    return { message: `Invited ${invitee.email} to the guild.` };
  }

  // ============================================
  // VOTE FOR LEADER
  // ============================================
  async voteForLeader(userId: string, guildId: string, dto: VoteForLeaderDto): Promise<{ message: string }> {
    const membership = await this.prisma.arenaGuildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
    if (!membership) throw new BadRequestException('You are not a member of this guild.');

    const candidate = await this.prisma.arenaGuildMember.findUnique({
      where: { guildId_userId: { guildId, userId: dto.candidateId } },
    });
    if (!candidate) throw new BadRequestException('Candidate is not a member of this guild.');

    // Record the vote (upsert — one vote per member).
    await this.prisma.arenaGuildVote.upsert({
      where: { guildId_voterId: { guildId, voterId: userId } },
      create: { guildId, voterId: userId, candidateId: dto.candidateId },
      update: { candidateId: dto.candidateId },
    });

    // Count votes for the candidate. If majority (>50%), promote them.
    const totalMembers = await this.prisma.arenaGuildMember.count({ where: { guildId } });
    const votesForCandidate = await this.prisma.arenaGuildVote.count({
      where: { guildId, candidateId: dto.candidateId },
    });

    if (votesForCandidate > totalMembers / 2) {
      await this.prisma.arenaGuild.update({
        where: { id: guildId },
        data: { leaderId: dto.candidateId },
      });
      await this.prisma.arenaGuildMember.updateMany({
        where: { guildId, userId: dto.candidateId },
        data: { role: 'LEADER' },
      });
      await this.prisma.arenaGuildMember.updateMany({
        where: { guildId, userId: { not: dto.candidateId } },
        data: { role: 'MEMBER' },
      });
      return { message: 'Vote recorded. The candidate is now the guild leader!' };
    }

    return { message: `Vote recorded. ${votesForCandidate}/${totalMembers} votes needed for majority.` };
  }

  // ============================================
  // SET COMPETITION SQUAD (leader only)
  // ============================================
  async setCompetitionSquad(userId: string, guildId: string, dto: SetCompetitionSquadDto): Promise<GuildDto> {
    const guild = await this.prisma.arenaGuild.findUnique({ where: { id: guildId } });
    if (!guild) throw new NotFoundException(`Guild with ID "${guildId}" not found`);
    if (guild.leaderId !== userId) {
      throw new BadRequestException('Only the guild leader can select the competition squad.');
    }

    // Reset all members, then mark the selected ones.
    await this.prisma.arenaGuildMember.updateMany({
      where: { guildId },
      data: { inCompetitionSquad: false },
    });
    if (dto.memberIds.length > 0) {
      await this.prisma.arenaGuildMember.updateMany({
        where: { guildId, userId: { in: dto.memberIds } },
        data: { inCompetitionSquad: true },
      });
    }

    return this.getGuild(guildId);
  }

  // ============================================
  // HELPERS
  // ============================================
  private toGuildDto(guild: any): GuildDto {
    const members: GuildMemberDto[] = guild.members.map((m: any) => ({
      userId: m.userId,
      name: `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || 'Anonymous',
      role: m.role,
      inCompetitionSquad: m.inCompetitionSquad,
      points: m.user.arenaLeaderboard?.points ?? 0,
      wins: m.user.arenaLeaderboard?.wins ?? 0,
    }));

    return {
      id: guild.id,
      name: guild.name,
      description: guild.description,
      leaderId: guild.leaderId,
      points: guild.points,
      members,
    };
  }
}