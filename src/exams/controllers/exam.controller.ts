import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiCookieAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreateExamDto } from '../dto/create-exam.dto';
import { UpdateExamDto } from '../dto/update-exam.dto';
import { AddQuestionsDto } from '../dto/add-questions.dto';
import { ExamService } from '../services/exam.service';

@ApiTags('Exams')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('exams')
export class ExamController {
  constructor(private readonly examService: ExamService) {}

  @Post()
  async createExam(@Body() dto: CreateExamDto) {
    return this.examService.createExam(dto);
  }

  @Get()
  async getExams() {
    return this.examService.getExams();
  }

  @Get(':id')
  async getExam(@Param('id') id: string) {
    return this.examService.getExamById(id);
  }

  @Put(':id')
  async updateExam(
    @Param('id') id: string,
    @Body() dto: UpdateExamDto,
  ) {
    return this.examService.updateExam(id, dto);
  }

  @Delete(':id')
  async deleteExam(@Param('id') id: string) {
    return this.examService.deleteExam(id);
  }

  @Post(':id/questions')
  async addQuestions(
    @Param('id') examId: string,
    @Body() dto: AddQuestionsDto,
  ) {
    return this.examService.addQuestionsToExam(examId, dto);
  }

  @Delete(':examId/questions/:questionId')
  async removeQuestion(
    @Param('examId') examId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.examService.removeQuestionFromExam(examId, questionId);
  }

  @Get(':id/statistics')
  async getStatistics(@Param('id') id: string) {
    return this.examService.getExamStatistics(id);
  }
}
