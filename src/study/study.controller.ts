import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateStudySessionDto, SubmitStudyAnswerDto } from './dto/create-study-session.dto';
import { FlagQuestionDto } from '../common/dto/flag-question.dto';
import { StudyService } from './study.service';

interface RequestWithUser extends Request {
  user: { id: string };
}

@ApiTags('Study Mode')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('study/sessions')
export class StudyController {
  constructor(private readonly studyService: StudyService) {}

  @Post()
  @ApiOperation({ summary: 'Create a 20-question untimed study session' })
  async create(@Req() req: RequestWithUser, @Body() dto: CreateStudySessionDto) {
    return this.studyService.createSession(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List the current student study sessions' })
  async list(@Req() req: RequestWithUser) {
    return this.studyService.listSessions(req.user.id);
  }

  @Post(':sessionId/questions/:questionId/open')
  @ApiOperation({ summary: 'Record that a study question was opened' })
  async openQuestion(@Req() req: RequestWithUser, @Param('sessionId') sessionId: string, @Param('questionId') questionId: string) {
    return this.studyService.openQuestion(sessionId, questionId, req.user.id);
  }

  @Post(':sessionId/questions/:questionId/answer')
  @ApiOperation({ summary: 'Submit an answer attempt for a study question' })
  async answer(@Req() req: RequestWithUser, @Param('sessionId') sessionId: string, @Param('questionId') questionId: string, @Body() dto: SubmitStudyAnswerDto) {
    return this.studyService.submitAnswer(sessionId, questionId, req.user.id, dto.selectedChoiceId);
  }

  @Patch(':sessionId/questions/:questionId/flag')
  @ApiOperation({ summary: 'Flag or unflag a question in a study session' })
  async flagQuestion(@Req() req: RequestWithUser, @Param('sessionId') sessionId: string, @Param('questionId') questionId: string, @Body() dto: FlagQuestionDto) {
    return this.studyService.setQuestionFlag(sessionId, questionId, req.user.id, dto.isFlagged);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a study session and its 20-question snapshot' })
  async get(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.studyService.getSession(id, req.user.id);
  }
}
