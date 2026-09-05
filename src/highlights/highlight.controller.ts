import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QuestionFlagContext } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateHighlightDto, UpdateHighlightDto } from './dto/highlight.dto';
import { HighlightService } from './highlight.service';

interface RequestWithUser extends Request {
  user: { id: string };
}

@ApiTags('Question Highlights')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('highlights')
export class HighlightController {
  constructor(private readonly highlightService: HighlightService) {}

  // ---- Exam context (admin exam or student mock exam) ----

  @Get('exam/:examId/questions/:questionId')
  @ApiOperation({ summary: 'List the current student highlights for an exam question' })
  async listForExamQuestion(
    @Req() req: RequestWithUser,
    @Param('examId') examId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.highlightService.listForQuestion(req.user.id, QuestionFlagContext.ADMIN_EXAM, examId, questionId);
  }

  @Post('exam/:examId/questions/:questionId')
  @ApiOperation({ summary: 'Create a highlight on an exam question' })
  async createForExamQuestion(
    @Req() req: RequestWithUser,
    @Param('examId') examId: string,
    @Param('questionId') questionId: string,
    @Body() dto: CreateHighlightDto,
  ) {
    return this.highlightService.create(req.user.id, QuestionFlagContext.ADMIN_EXAM, examId, questionId, dto);
  }

  // ---- Study session context ----

  @Get('study/:sessionId/questions/:questionId')
  @ApiOperation({ summary: 'List the current student highlights for a study question' })
  async listForStudyQuestion(
    @Req() req: RequestWithUser,
    @Param('sessionId') sessionId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.highlightService.listForQuestion(req.user.id, QuestionFlagContext.STUDY_SESSION, sessionId, questionId);
  }

  @Post('study/:sessionId/questions/:questionId')
  @ApiOperation({ summary: 'Create a highlight on a study question' })
  async createForStudyQuestion(
    @Req() req: RequestWithUser,
    @Param('sessionId') sessionId: string,
    @Param('questionId') questionId: string,
    @Body() dto: CreateHighlightDto,
  ) {
    return this.highlightService.create(req.user.id, QuestionFlagContext.STUDY_SESSION, sessionId, questionId, dto);
  }

  // ---- Shared highlight CRUD (by highlight id) ----

  @Patch(':highlightId')
  @ApiOperation({ summary: 'Update a highlight color or note' })
  async update(
    @Req() req: RequestWithUser,
    @Param('highlightId') highlightId: string,
    @Body() dto: UpdateHighlightDto,
  ) {
    return this.highlightService.update(req.user.id, highlightId, dto);
  }

  @Delete(':highlightId')
  @ApiOperation({ summary: 'Delete a highlight' })
  async remove(@Req() req: RequestWithUser, @Param('highlightId') highlightId: string) {
    return this.highlightService.remove(req.user.id, highlightId);
  }
}