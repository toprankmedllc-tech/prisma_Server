import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExamDto } from '../dto/create-exam.dto';

import { AddQuestionsDto } from '../dto/add-questions.dto';
import { UpdateExamDto } from '../dto/update-exam.dto';

@Injectable()
export class ExamService {
  constructor(private prisma: PrismaService) {}

  async createExam(dto: CreateExamDto) {
    return this.prisma.exam.create({
      data: {
        title: dto.title,
        durationMin: dto.durationMin,
        // description: dto.description,
      },
    });
  }

  async getExamById(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            question: {
              include: {
                choices: true,
                topic: true,
              },
            },
          },
        },
        examAttempts: {
          orderBy: {
            score: 'desc',
          },
          take: 10,
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException(`Exam with ID ${id} not found`);
    }

    return exam;
  }

  async getExams() {
    return this.prisma.exam.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateExam(id: string, dto: UpdateExamDto) {
    return this.prisma.exam.update({
      where: { id },
      data: dto,
    });
  }

  async deleteExam(id: string) {
    // Delete related exam questions first to avoid foreign key constraint
    await this.prisma.examQuestion.deleteMany({
      where: { examId: id },
    });

    return this.prisma.exam.delete({
      where: { id },
    });
  }

  async addQuestionsToExam(examId: string, dto: AddQuestionsDto) {
    await this.prisma.examQuestion.createMany({
      data: dto.questionIds.map(questionId => ({
        examId,
        questionId,
      })),
      skipDuplicates: true,
    });

    return this.getExamById(examId);
  }

  async removeQuestionFromExam(examId: string, questionId: string) {
    return this.prisma.examQuestion.delete({
      where: {
        examId_questionId: {
          examId,
          questionId,
        },
      },
    });
  }

  async getExamStatistics(examId: string) {
    const [attemptsCount, avgScore, questionsCount] = await Promise.all([
      this.prisma.examAttempt.count({
        where: { examId },
      }),
      this.prisma.examAttempt.aggregate({
        where: { examId },
        _avg: { score: true },
      }),
      this.prisma.examQuestion.count({
        where: { examId },
      }),
    ]);

    return {
      attemptsCount,
      avgScore: avgScore._avg.score,
      questionsCount,
    };
  }
}
