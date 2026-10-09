import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdaptiveSessionService } from './adaptive-session.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

interface RequestWithUser extends Request {
  user: { id: string; email: string };
}

@ApiTags('Adaptive')
@Controller('adaptive')
export class AdaptiveSessionController {
  constructor(private adaptiveSessionService: AdaptiveSessionService) {}

  @UseGuards(JwtAuthGuard)
  @Post('sessions')
  @ApiOperation({ summary: 'Start a new adaptive session' })
  async startSession(@Req() req: RequestWithUser, @Body() body?: any) {
    return this.adaptiveSessionService.startSession(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions/:sessionId/question')
  @ApiOperation({ summary: 'Get next question in adaptive session' })
  async getNextQuestion(@Req() req: RequestWithUser, @Param('sessionId') sessionId: string) {
    return this.adaptiveSessionService.getNextQuestion(sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/:sessionId/attempts')
  @ApiOperation({ summary: 'Record answer attempt' }) 
  async recordAnswer(
    @Req() req: RequestWithUser,
    @Param('sessionId') sessionId: string,
    @Body() body: { questionId: string; choiceId: string; timeSpentSec: number }
  ) {
    return this.adaptiveSessionService.recordAnswer(
      sessionId,
      body.questionId,
      body.choiceId,
      body.timeSpentSec
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions/:sessionId/analytics')
  @ApiOperation({ summary: 'Get session analytics' })
  async getAnalytics(@Req() req: RequestWithUser, @Param('sessionId') sessionId: string) {
    return this.adaptiveSessionService.getSessionAnalytics(sessionId);
  }
}