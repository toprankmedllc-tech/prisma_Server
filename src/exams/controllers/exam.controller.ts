import {
  Body, Controller, Delete, Get, Param, Post, Put, Patch, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiCookieAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../admin/admin.guard';
import { CreateExamDto } from '../dto/create-exam.dto';
import { UpdateExamDto } from '../dto/update-exam.dto';
import { ExamService } from '../services/exam.service';

@ApiTags('Exams')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('exams')
export class ExamController {
  constructor(private readonly examService: ExamService) {}

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