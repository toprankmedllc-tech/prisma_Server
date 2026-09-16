import { Controller, Get, Post, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GuildService } from './guild.service';
import {
  CreateGuildDto,
  InviteToGuildDto,
  VoteForLeaderDto,
  SetCompetitionSquadDto,
} from './dto/guild.dto';

interface RequestWithUser extends Request {
  user: { id: string };
}

@ApiTags('Guilds')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('guilds')
export class GuildController {
  constructor(private readonly guildService: GuildService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new guild (creator becomes leader)' })
  async createGuild(@Req() req: RequestWithUser, @Body() dto: CreateGuildDto) {
    return this.guildService.createGuild(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all guilds' })
  async listGuilds() {
    return this.guildService.listGuilds();
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the current user guild (or null)' })
  async getMyGuild(@Req() req: RequestWithUser) {
    return this.guildService.getMyGuild(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a guild by ID' })
  async getGuild(@Param('id') id: string) {
    return this.guildService.getGuild(id);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a guild' })
  async joinGuild(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.guildService.joinGuild(req.user.id, id);
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'Leave a guild' })
  async leaveGuild(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.guildService.leaveGuild(req.user.id, id);
  }

  @Post(':id/invite')
  @ApiOperation({ summary: 'Invite a user to the guild (leader only)' })
  async inviteToGuild(@Req() req: RequestWithUser, @Param('id') id: string, @Body() dto: InviteToGuildDto) {
    return this.guildService.inviteToGuild(req.user.id, id, dto);
  }

  @Post(':id/vote')
  @ApiOperation({ summary: 'Vote for a guild leader' })
  async voteForLeader(@Req() req: RequestWithUser, @Param('id') id: string, @Body() dto: VoteForLeaderDto) {
    return this.guildService.voteForLeader(req.user.id, id, dto);
  }

  @Post(':id/competition-squad')
  @ApiOperation({ summary: 'Set the competition squad (leader only)' })
  async setCompetitionSquad(@Req() req: RequestWithUser, @Param('id') id: string, @Body() dto: SetCompetitionSquadDto) {
    return this.guildService.setCompetitionSquad(req.user.id, id, dto);
  }
}