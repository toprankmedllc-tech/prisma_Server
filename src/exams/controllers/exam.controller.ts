import {
  Body, Controller, Delete, Get, Param, Post, Put, Patch, UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { ApiTags, ApiCookieAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../admin/admin.guard';
import { CreateExamDto } from '../dto/create-exam.dto';
import { CreateMockExamDto, MockChatDto, MockTipDto, SubmitMockAnswerDto } from '../dto/create-mock-exam.dto';
import { Request } from 'express';
import { UpdateExamDto } from '../dto/update-exam.dto';
import { FlagQuestionDto } from '../../common/dto/flag-question.dto';
import { ExamService } from '../services/exam.service';

interface RequestWithUser extends Request {
  user: { id: string };
}

@ApiTags('Exams')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('exams')
export class ExamController {
  constructor(private readonly examService: ExamService) {}

  @Post('mock')
  @ApiOperation({ summary: 'Create a student-owned mock exam' })
  async createMockExam(@Req() req: RequestWithUser, @Body() dto: CreateMockExamDto) {
    return this.examService.createMockExam(req.user.id, dto);
  }

  @Get('mock/mine')
  @ApiOperation({ summary: 'List the current student mock exams and scores' })
  async getMyMockExams(@Req() req: RequestWithUser) {
    return this.examService.getMyMockExams(req.user.id);
  }

  @Get('mock/available')
  @ApiOperation({ summary: 'List active admin-created exams available to students' })
  async getAvailableAdminExams(@Req() req: RequestWithUser) {
    return this.examService.getAvailableAdminExams(req.user.id);
  }

  @Post('mock/:id/start')
  async startMockAttempt(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.examService.startMockAttempt(id, req.user.id);
  }

  @Get('mock/attempt/:attemptId/block')
  async getAttemptBlock(@Req() req: RequestWithUser, @Param('attemptId') attemptId: string) {
    return this.examService.getAttemptBlock(attemptId, req.user.id);
  }

  @Post('mock/tip')
  @ApiOperation({ summary: 'Spend one diamond to generate a question tip' })
  async generateMockQuestionTip(@Req() req: RequestWithUser, @Body() dto: MockTipDto) {
    return this.examService.generateMockQuestionTip(req.user.id, dto);
  }

  @Post('mock/chat')
  @ApiOperation({ summary: 'Ask ThoughtProcess about a mock question' })
  async chatAboutMockQuestion(@Req() req: RequestWithUser, @Body() dto: MockChatDto) {
    return this.examService.chatAboutMockQuestion(req.user.id, dto);
  }

  @Post('mock/attempt/:attemptId/questions/:questionId/answer')
  async submitMockAnswer(@Req() req: RequestWithUser, @Param('attemptId') attemptId: string, @Param('questionId') questionId: string, @Body() dto: SubmitMockAnswerDto) {
    return this.examService.submitMockAnswer(attemptId, questionId, req.user.id, dto);
  }

  @Post('mock/attempt/:attemptId/complete-block')
  async completeMockBlock(@Req() req: RequestWithUser, @Param('attemptId') attemptId: string) {
    return this.examService.completeMockBlock(attemptId, req.user.id);
  }

  @Get('mock/attempt/:attemptId/results')
  async getMockResults(@Req() req: RequestWithUser, @Param('attemptId') attemptId: string) {
    return this.examService.getMockResults(attemptId, req.user.id);
  }

  @Post()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Create a new exam with random question selection per block' })
  async createExam(@Body() dto: CreateExamDto) {
    return this.examService.createExam(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all exams' })
  async getExams() {
    return this.examService.getExams();
  }

  @Patch(':examId/questions/:questionId/flag')
  @ApiOperation({ summary: 'Flag or unflag a question in an admin or mock exam' })
  async flagExamQuestion(@Req() req: RequestWithUser, @Param('examId') examId: string, @Param('questionId') questionId: string, @Body() dto: FlagQuestionDto) {
    return this.examService.setQuestionFlag(req.user.id, examId, questionId, dto.isFlagged);
  }

  @Get(':examId/questions/:questionId/flag')
  @ApiOperation({ summary: 'Get the current student flag state for an exam question' })
  async getExamQuestionFlag(@Req() req: RequestWithUser, @Param('examId') examId: string, @Param('questionId') questionId: string) {
    return this.examService.getQuestionFlag(req.user.id, examId, questionId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get exam details with blocks, questions, and attempts' })
  async getExam(@Param('id') id: string) {
    return this.examService.getExamById(id);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Update exam settings and optionally reassign questions' })
  async updateExam(@Param('id') id: string, @Body() dto: UpdateExamDto) {
    return this.examService.updateExam(id, dto);
  }

  @Patch(':id/toggle-active')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Enable or disable an exam (disable instead of delete)' })
  async toggleActive(@Param('id') id: string) {
    const exam = await this.examService.getExamById(id);
    return this.examService.updateExam(id, { isActive: !exam.isActive });
  }

  @Post(':id/regenerate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Regenerate questions for the exam (re-randomize)' })
  async regenerateExam(@Param('id') id: string) {
    return this.examService.regenerateExam(id);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Permanently delete an exam (use disable instead when possible)' })
  async deleteExam(@Param('id') id: string) {
    return this.examService.deleteExam(id);
  }
}