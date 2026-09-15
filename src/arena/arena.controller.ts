import { Controller, Get, Post, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ArenaService } from './arena.service';
import { CreateArenaBattleDto, SubmitArenaAnswerDto } from './dto/arena.dto';

interface RequestWithUser extends Request {
  user: { id: string };
}

@ApiTags('Arena')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('arena')
export class ArenaController {
  constructor(private readonly arenaService: ArenaService) {}

  // ============================================
  // CREATE A BATTLE
  // ============================================
  @Post('battles')
  @ApiOperation({ summary: 'Create a new arena battle against an opponent' })
  async createBattle(@Req() req: RequestWithUser, @Body() dto: CreateArenaBattleDto) {
    return this.arenaService.createBattle(req.user.id, dto);
  }

  // ============================================
  // GET A BATTLE
  // ============================================
  @Get('battles/:id')
  @ApiOperation({ summary: 'Get an arena battle with its questions' })
  async getBattle(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.arenaService.getBattle(req.user.id, id);
  }

  // ============================================
  // SUBMIT AN ANSWER
  // ============================================
  @Post('battles/:id/answer')
  @ApiOperation({ summary: 'Submit an answer for a battle question' })
  async submitAnswer(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: SubmitArenaAnswerDto,
  ) {
    return this.arenaService.submitAnswer(req.user.id, id, dto);
  }

  // ============================================
  // COMPLETE A BATTLE
  // ============================================
  @Post('battles/:id/complete')
  @ApiOperation({ summary: 'Complete a battle and update the leaderboard' })
  async completeBattle(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.arenaService.completeBattle(req.user.id, id);
  }

  // ============================================
  // LEADERBOARD
  // ============================================
  @Get('leaderboard')
  @ApiOperation({ summary: 'Get the global arena leaderboard' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max entries (default 50)' })
  async getLeaderboard(@Query('limit') limit?: string) {
    return this.arenaService.getLeaderboard(limit ? parseInt(limit, 10) : 50);
  }

  // ============================================
  // MY STATS
  // ============================================
  @Get('me')
  @ApiOperation({ summary: 'Get the current user arena stats' })
  async getMyStats(@Req() req: RequestWithUser) {
    return this.arenaService.getMyStats(req.user.id);
  }
}