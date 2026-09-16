import { Controller, Get, Post, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/social.dto';

interface RequestWithUser extends Request {
  user: { id: string };
}

@ApiTags('Chat')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(':otherId')
  @ApiOperation({ summary: 'Get the conversation with another user' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getConversation(
    @Req() req: RequestWithUser,
    @Param('otherId') otherId: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getConversation(req.user.id, otherId, limit ? parseInt(limit, 10) : 50);
  }

  @Post()
  @ApiOperation({ summary: 'Send a message to another user' })
  async sendMessage(@Req() req: RequestWithUser, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(req.user.id, dto.receiverId, dto.content);
  }

  @Post(':otherId/read')
  @ApiOperation({ summary: 'Mark messages from another user as read' })
  async markRead(@Req() req: RequestWithUser, @Param('otherId') otherId: string) {
    return this.chatService.markRead(req.user.id, otherId);
  }

  @Get('unread/counts')
  @ApiOperation({ summary: 'Get unread message counts per sender' })
  async getUnreadCounts(@Req() req: RequestWithUser) {
    return this.chatService.getUnreadCounts(req.user.id);
  }

  @Get('unread/total')
  @ApiOperation({ summary: 'Get total unread message count' })
  async getTotalUnread(@Req() req: RequestWithUser) {
    return { total: await this.chatService.getTotalUnread(req.user.id) };
  }
}