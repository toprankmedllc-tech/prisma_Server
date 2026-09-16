import { Controller, Get, Post, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TeamBattleService } from './team-battle.service';
import { CreateTeamBattleDto, SubmitTeamAnswerDto } from './dto/guild.dto';

interface RequestWithUser extends Request {
  user: { id: string };
}

@ApiTags('Team Battles')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('arena/team-battles')
export class TeamBattleController {
  constructor(private readonly teamBattleService: TeamBattleService) {}

  @Post()
  @ApiOperation({ summary: 'Create a 4v4 team battle (invite up to 3 teammates)' })
  async createTeamBattle(@Req() req: RequestWithUser, @Body() dto: CreateTeamBattleDto) {
    return this.teamBattleService.createTeamBattle(req.user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a team battle' })
  async getTeamBattle(@Param('id') id: string) {
    return this.teamBattleService.getTeamBattle(id);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a team battle as Team B' })
  async joinTeamBattle(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.teamBattleService.joinTeamBattle(req.user.id, id);
  }

  @Post(':id/answer')
  @ApiOperation({ summary: 'Submit a team answer (any member can answer)' })
  async submitTeamAnswer(@Req() req: RequestWithUser, @Param('id') id: string, @Body() dto: SubmitTeamAnswerDto) {
    return this.teamBattleService.submitTeamAnswer(req.user.id, id, dto);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete a team battle and award diamonds to the winning team' })
  async completeTeamBattle(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.teamBattleService.completeTeamBattle(req.user.id, id);
  }
}