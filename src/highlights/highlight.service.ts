import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, QuestionFlagContext } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHighlightDto, UpdateHighlightDto } from './dto/highlight.dto';

const HIGHLIGHT_COLORS = new Set(['yellow', 'green', 'blue', 'pink', 'purple']);

@Injectable()
export class HighlightService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate that the user owns the given context (exam / study session) and that
   * the question belongs to it.
   *
   * For study sessions the `questionId` route param is the StudySessionQuestion
   * join-record id, so it is resolved to the real Question id here. Returns the
   * resolved QuestionFlagContext enum and canonical Question id.
   */
  private async resolveContext(
    userId: string,
    context: QuestionFlagContext,
    contextId: string,
    questionId: string,
  ): Promise<{ context: QuestionFlagContext; questionId: string }> {
    if (context === QuestionFlagContext.STUDY_SESSION) {
      const item = await this.prisma.studySessionQuestion.findFirst({
        where: { id: questionId, sessionId: contextId, session: { userId } },
        select: { questionId: true },
      });
      if (!item) throw new NotFoundException('Study question not found.');
      return { context: QuestionFlagContext.STUDY_SESSION, questionId: item.questionId };
    }

    // Exam contexts (admin or student mock); the param is already the real Question id.
    const exam = await this.prisma.exam.findFirst({
      where: {
        id: contextId,
        isActive: true,
        OR: [
          { mode: 'ADMIN' },
          { mode: 'STUDENT_MOCK', createdById: userId },
        ],
      },
      select: { id: true, mode: true },
    });
    if (!exam) throw new NotFoundException('Exam not found or unavailable.');

    const examQuestion = await this.prisma.examQuestion.findUnique({
      where: { examId_questionId: { examId: contextId, questionId } },
      select: { questionId: true },
    });
    if (!examQuestion) throw new NotFoundException('Question does not belong to this exam.');

    return {
      context: exam.mode === 'ADMIN' ? QuestionFlagContext.ADMIN_EXAM : QuestionFlagContext.MOCK_EXAM,
      questionId,
    };
  }

  private normalizeColor(color?: string): string {
    const value = (color || 'yellow').toLowerCase();
    return HIGHLIGHT_COLORS.has(value) ? value : 'yellow';
  }

  async listForQuestion(
    userId: string,
    context: QuestionFlagContext,
    contextId: string,
    questionId: string,
  ) {
    const resolved = await this.resolveContext(userId, context, contextId, questionId);
    return this.prisma.questionHighlight.findMany({
      where: { userId, questionId: resolved.questionId, context: resolved.context, contextId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        textRoot: true,
        start: true,
        end: true,
        text: true,
        color: true,
        note: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(
    userId: string,
    context: QuestionFlagContext,
    contextId: string,
    questionId: string,
    dto: CreateHighlightDto,
  ) {
    const resolved = await this.resolveContext(userId, context, contextId, questionId);
    if (dto.end <= dto.start) {
      throw new BadRequestException('Highlight end offset must be greater than start offset.');
    }
    return this.prisma.questionHighlight.create({
      data: {
        userId,
        questionId: resolved.questionId,
        context: resolved.context,
        contextId,
        textRoot: dto.textRoot,
        start: dto.start,
        end: dto.end,
        text: dto.text,
        color: this.normalizeColor(dto.color),
        note: dto.note || null,
      },
      select: {
        id: true,
        textRoot: true,
        start: true,
        end: true,
        text: true,
        color: true,
        note: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(
    userId: string,
    highlightId: string,
    dto: UpdateHighlightDto,
  ) {
    const existing = await this.prisma.questionHighlight.findFirst({
      where: { id: highlightId, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Highlight not found.');

    return this.prisma.questionHighlight.update({
      where: { id: highlightId },
      data: {
        ...(dto.color !== undefined ? { color: this.normalizeColor(dto.color) } : {}),
        ...(dto.note !== undefined ? { note: dto.note || null } : {}),
      },
      select: {
        id: true,
        textRoot: true,
        start: true,
        end: true,
        text: true,
        color: true,
        note: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(userId: string, highlightId: string) {
    const existing = await this.prisma.questionHighlight.findFirst({
      where: { id: highlightId, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Highlight not found.');
    await this.prisma.questionHighlight.delete({ where: { id: highlightId } });
    return { id: highlightId, deleted: true };
  }
}