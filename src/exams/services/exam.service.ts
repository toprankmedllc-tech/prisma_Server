import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExamDto } from '../dto/create-exam.dto';
import { UpdateExamDto } from '../dto/update-exam.dto';

@Injectable()
export class ExamService {
  private readonly logger = new Logger(ExamService.name);

  constructor(private prisma: PrismaService) {}

  async createExam(dto: CreateExamDto) {
    const blockCount = dto.blockCount || 8;
    const questionsPerBlock = dto.questionsPerBlock || 20;
    const secondsPerQuestion = dto.secondsPerQuestion || 90;
    const totalQuestionsNeeded = blockCount * questionsPerBlock;
    const durationMin = Math.round((blockCount * questionsPerBlock * secondsPerQuestion) / 60);

    // Validate there are enough questions
    const availableCount = await this.countAvailableQuestions(dto.selectionSettings);
    if (availableCount < totalQuestionsNeeded) {
      throw new BadRequestException(
        `Not enough questions available. Need ${totalQuestionsNeeded}, but only ${availableCount} match the selection criteria.`
      );
    }

    // Create the exam
    const exam = await this.prisma.exam.create({
      data: {
        title: dto.title,
        description: dto.description || null,
        blockCount,
        questionsPerBlock,
        secondsPerQuestion,
        durationMin,
        selectionSettings: this.toJsonValue(dto.selectionSettings),
        isActive: true,
      },
    });

    // Randomly select and assign questions per block
    await this.assignQuestionsToBlocks(exam.id, blockCount, questionsPerBlock, dto.selectionSettings);

    return this.getExamById(exam.id);
  }

  private toJsonValue(value: any): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  async getExams() {
    const exams = await this.prisma.exam.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { questions: true, examAttempts: true } },
      },
    });

    return exams.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      blockCount: e.blockCount,
      questionsPerBlock: e.questionsPerBlock,
      secondsPerQuestion: e.secondsPerQuestion,
      durationMin: e.durationMin,
      selectionSettings: e.selectionSettings,
      isActive: e.isActive,
      questionCount: e._count.questions,
      attemptCount: e._count.examAttempts,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));
  }

  async getExamById(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: [{ blockIndex: 'asc' }],
          include: {
            question: {
              include: {
                choices: { orderBy: { order: 'asc' } },
                topic: { include: { subject: true } },
              },
            },
          },
        },
        examAttempts: {
          orderBy: { startedAt: 'desc' },
          take: 20,
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        _count: { select: { examAttempts: true } },
      },
    });

    if (!exam) throw new NotFoundException(`Exam with ID ${id} not found`);

    // Group questions by block
    const blocks: { blockIndex: number; questions: any[] }[] = [];
    const blockMap = new Map<number, any[]>();
    for (const eq of exam.questions) {
      const arr = blockMap.get(eq.blockIndex) || [];
      arr.push(eq.question);
      blockMap.set(eq.blockIndex, arr);
    }
    for (const [blockIndex, questions] of blockMap) {
      blocks.push({ blockIndex, questions });
    }
    blocks.sort((a, b) => a.blockIndex - b.blockIndex);

    return {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      blockCount: exam.blockCount,
      questionsPerBlock: exam.questionsPerBlock,
      secondsPerQuestion: exam.secondsPerQuestion,
      durationMin: exam.durationMin,
      selectionSettings: exam.selectionSettings,
      isActive: exam.isActive,
      totalQuestions: exam.questions.length,
      blocks,
      attempts: exam.examAttempts,
      attemptCount: exam._count.examAttempts,
      createdAt: exam.createdAt,
      updatedAt: exam.updatedAt,
    };
  }

  async updateExam(id: string, dto: UpdateExamDto) {
    const existing = await this.prisma.exam.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Exam with ID ${id} not found`);

    const updateData: any = {};

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.selectionSettings !== undefined) updateData.selectionSettings = this.toJsonValue(dto.selectionSettings);

    if (dto.blockCount !== undefined || dto.questionsPerBlock !== undefined || dto.secondsPerQuestion !== undefined) {
      const blockCount = dto.blockCount ?? existing.blockCount;
      const questionsPerBlock = dto.questionsPerBlock ?? existing.questionsPerBlock;
      const secondsPerQuestion = dto.secondsPerQuestion ?? existing.secondsPerQuestion;

      updateData.blockCount = blockCount;
      updateData.questionsPerBlock = questionsPerBlock;
      updateData.secondsPerQuestion = secondsPerQuestion;
      updateData.durationMin = Math.round((blockCount * questionsPerBlock * secondsPerQuestion) / 60);

      // If structure changed, reassign questions
      if (blockCount !== existing.blockCount || questionsPerBlock !== existing.questionsPerBlock) {
        await this.prisma.examQuestion.deleteMany({ where: { examId: id } });
        const settings = dto.selectionSettings || (existing.selectionSettings as any);
        await this.assignQuestionsToBlocks(id, blockCount, questionsPerBlock, settings || undefined);
      }
    }

    return this.prisma.exam.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteExam(id: string) {
    await this.prisma.examQuestion.deleteMany({ where: { examId: id } });
    await this.prisma.examAttempt.deleteMany({ where: { examId: id } });
    return this.prisma.exam.delete({ where: { id } });
  }

  async regenerateExam(id: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id } });
    if (!exam) throw new NotFoundException(`Exam with ID ${id} not found`);

    await this.prisma.examQuestion.deleteMany({ where: { examId: id } });
    await this.assignQuestionsToBlocks(id, exam.blockCount, exam.questionsPerBlock, (exam.selectionSettings as any) || undefined);

    return this.getExamById(id);
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async countAvailableQuestions(selectionSettings?: any): Promise<number> {
    const where = this.buildQuestionWhere(selectionSettings);
    return this.prisma.question.count({ where });
  }

  private buildQuestionWhere(settings?: any) {
    const where: any = {};

    if (!settings) {
      where.isPublished = true;
      return where;
    }

    if (settings.onlyPublished !== false) {
      where.isPublished = true;
    }

    if (settings.subjects?.length) {
      where.topic = {
        subject: {
          name: { in: settings.subjects, mode: 'insensitive' },
        },
      };
    }

    if (settings.topics?.length) {
      where.topic = {
        ...(where.topic || {}),
        name: { in: settings.topics, mode: 'insensitive' },
      };
    }

    if (settings.difficulties?.length) {
      where.difficulty = { in: settings.difficulties };
    }

    if (settings.sourceTypes?.length) {
      where.sourceType = { in: settings.sourceTypes };
    }

    if (settings.examType) {
      where.discipline = { contains: settings.examType.replace(/_/g, ' '), mode: 'insensitive' };
    }

    return where;
  }

  private async assignQuestionsToBlocks(
    examId: string,
    blockCount: number,
    questionsPerBlock: number,
    selectionSettings?: any,
  ) {
    const totalNeeded = blockCount * questionsPerBlock;
    const where = this.buildQuestionWhere(selectionSettings);

    // Get random questions from the pool
    const allQuestions = await this.prisma.question.findMany({
      where,
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    // Shuffle and pick
    const shuffled = this.shuffleArray(allQuestions.map((q) => q.id));
    const selected = shuffled.slice(0, totalNeeded);

    // Assign block indices
    const examQuestions = selected.map((questionId, index) => ({
      examId,
      questionId,
      blockIndex: Math.floor(index / questionsPerBlock),
    }));

    await this.prisma.examQuestion.createMany({ data: examQuestions });

    this.logger.log(`Assigned ${selected.length} questions across ${blockCount} blocks for exam ${examId}`);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}