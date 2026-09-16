import { Controller, Get, Post, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GuildChatService } from './guild-chat.service';

interface RequestWithUser extends Request {
  user: { id: string };
}

@ApiTags('Guild Chat')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('guilds/:guildId/messages')
export class GuildChatController {
  constructor(private readonly guildChatService: GuildChatService) {}

  @Get()
  @ApiOperation({ summary: 'Get guild chat messages (members only)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMessages(
    @Req() req: RequestWithUser,
    @Param('guildId') guildId: string,
    @Query('limit') limit?: string,
  ) {
    return this.guildChatService.getGuildMessages(req.user.id, guildId, limit ? parseInt(limit, 10) : 50);
  }

  @Post()
  @ApiOperation({ summary: 'Send a guild chat message' })
  async sendMessage(
    @Req() req: RequestWithUser,
    @Param('guildId') guildId: string,
    @Body() dto: { content: string },
  ) {
    return this.guildChatService.sendGuildMessage(req.user.id, guildId, dto.content);
  }
}