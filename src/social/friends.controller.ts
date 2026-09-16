import { Controller, Get, Post, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FriendsService } from './friends.service';
import { SendFriendRequestDto } from './dto/social.dto';

interface RequestWithUser extends Request {
  user: { id: string };
}

@ApiTags('Friends')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Post('request')
  @ApiOperation({ summary: 'Send a friend request (by user ID or email)' })
  async sendRequest(@Req() req: RequestWithUser, @Body() dto: SendFriendRequestDto) {
    return this.friendsService.sendRequest(req.user.id, dto.addressee);
  }

  @Get()
  @ApiOperation({ summary: 'List accepted friends with online status' })
  async listFriends(@Req() req: RequestWithUser) {
    return this.friendsService.listFriends(req.user.id);
  }

  @Get('requests')
  @ApiOperation({ summary: 'List incoming pending friend requests' })
  async listRequests(@Req() req: RequestWithUser) {
    return this.friendsService.listRequests(req.user.id);
  }

  @Post('accept/:requestId')
  @ApiOperation({ summary: 'Accept a friend request' })
  async acceptRequest(@Req() req: RequestWithUser, @Param('requestId') requestId: string) {
    return this.friendsService.acceptRequest(req.user.id, requestId);
  }

  @Post('decline/:requestId')
  @ApiOperation({ summary: 'Decline a friend request' })
  async declineRequest(@Req() req: RequestWithUser, @Param('requestId') requestId: string) {
    return this.friendsService.declineRequest(req.user.id, requestId);
  }

  @Post('remove/:friendId')
  @ApiOperation({ summary: 'Remove a friend' })
  async removeFriend(@Req() req: RequestWithUser, @Param('friendId') friendId: string) {
    return this.friendsService.removeFriend(req.user.id, friendId);
  }
}