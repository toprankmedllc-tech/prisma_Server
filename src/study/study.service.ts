import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, QuestionSourceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudySessionDto, StudyQuestionType } from './dto/create-study-session.dto';

@Injectable()
export class StudyService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(userId: string, dto: CreateStudySessionDto) {
    const subjectIds = [...new Set(dto.subjectIds?.length ? dto.subjectIds : dto.subjectId ? [dto.subjectId] : [])];
    if (!subjectIds.length) throw new BadRequestException('Select at least one subject.');

    const subjects = await this.prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true },
    });
    if (subjects.length !== subjectIds.length) throw new NotFoundException('One or more subjects were not found.');

    const difficulties = [...new Set(dto.difficulties?.length ? dto.difficulties : dto.difficulty ? [dto.difficulty] : [])];
    const where: Prisma.QuestionWhereInput = {
      isPublished: dto.isPublished ?? true,
      difficulty: difficulties.length ? { in: difficulties } : undefined,
      topic: { subjectId: { in: subjectIds } },
      ...(dto.questionType !== StudyQuestionType.BOTH ? { sourceType: dto.questionType as QuestionSourceType } : {}),
    };

    const available = await this.prisma.question.findMany({ where, select: { id: true } });
    if (!available.length) {
      throw new BadRequestException('No questions match the selected subjects, difficulty, question type, and publication filters.');
    }

    // Study Mode remains useful with a small question bank; use every available question up to 20.
    const selectedIds = this.shuffle(available.map(({ id }) => id)).slice(0, 20);
    const session = await this.prisma.studySession.create({
      data: {
        userId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        questionType: dto.questionType === StudyQuestionType.BOTH ? null : dto.questionType as QuestionSourceType,
        difficulty: difficulties.length === 1 ? difficulties[0] : null,
        subjectId: subjectIds.length === 1 ? subjectIds[0] : null,
        questions: { create: selectedIds.map((questionId, index) => ({ questionId, order: index + 1 })) },
      },
    });

    return this.getSession(session.id, userId);
  }

  async listSessions(userId: string) {
    return this.prisma.studySession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        subject: { select: { id: true, name: true } },
        questions: { select: { status: true } },
      },
    }).then((sessions) => sessions.map((session) => ({
      id: session.id,
      title: session.title,
      description: session.description,
      questionType: session.questionType,
      difficulty: session.difficulty,
      subject: session.subject,
      status: session.status,
      questionCount: session.questions.length,
      correctCount: session.questions.filter(({ status }) => status === 'CORRECT').length,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    })));
  }

  async getSession(id: string, userId: string) {
    const session = await this.prisma.studySession.findFirst({
      where: { id, userId },
      include: {
        subject: { select: { id: true, name: true } },
        questions: {
          orderBy: { order: 'asc' },
          include: {
            question: {
              select: {
                id: true,
                stem: true,
                leadInQuestion: true,
                patientProfile: true,
                chiefComplaint: true,
                keySymptoms: true,
                physicalExam: true,
                mainClue: true,
                supportingClue: true,
                suggestedImages: true,
                sourceType: true,
                difficulty: true,
                cognitiveLevel: true,
                topic: { select: { id: true, name: true, subject: { select: { id: true, name: true } } } },
                vitals: true,
                choices: { orderBy: { order: 'asc' }, select: { id: true, text: true, letter: true, order: true } },
              },
            },
          },
        },
      },
    });

    if (!session) throw new NotFoundException('Study session not found.');

    return {
      id: session.id,
      title: session.title,
      description: session.description,
      questionType: session.questionType,
      difficulty: session.difficulty,
      subject: session.subject,
      status: session.status,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      questions: session.questions.map((item) => ({
        id: item.id,
        order: item.order,
        status: item.status,
        attemptCount: item.attemptCount,
        totalTimeSpentSec: item.totalTimeSpentSec,
        firstDisplayedAt: item.firstDisplayedAt,
        lastDisplayedAt: item.lastDisplayedAt,
        answeredAt: item.answeredAt,
        question: item.question,
      })),
    };
  }

  async openQuestion(sessionId: string, questionId: string, userId: string) {
    const item = await this.prisma.studySessionQuestion.findFirst({
      where: { id: questionId, sessionId, session: { userId } },
    });
    if (!item) throw new NotFoundException('Study question not found.');
    if (item.status === 'CORRECT') return { questionId: item.questionId, status: item.status, openedAt: item.lastDisplayedAt };

    const now = new Date();
    const updated = await this.prisma.studySessionQuestion.update({
      where: { id: item.id },
      data: {
        firstDisplayedAt: item.firstDisplayedAt || now,
        lastDisplayedAt: now,
      },
    });
    return { questionId: updated.questionId, status: updated.status, openedAt: updated.lastDisplayedAt };
  }

  async submitAnswer(sessionId: string, questionId: string, userId: string, selectedChoiceId: string) {
    const item = await this.prisma.studySessionQuestion.findFirst({
      where: { id: questionId, sessionId, session: { userId } },
      include: { question: { include: { choices: { orderBy: { order: 'asc' } } } } },
    });
    if (!item) throw new NotFoundException('Study question not found.');
    if (item.status === 'CORRECT') {
      const correctChoice = item.question.choices.find((choice) => choice.isCorrect);
      return {
        questionId: item.questionId,
        isCorrect: true,
        status: item.status,
        attemptCount: item.attemptCount,
        timeSpentSec: 0,
        pointsAwarded: item.pointsAwarded,
        correctChoice: correctChoice ? { id: correctChoice.id, letter: correctChoice.letter, text: correctChoice.text } : null,
        explanation: item.question.explanation,
        sessionCompleted: false,
      };
    }

    const choice = item.question.choices.find(({ id }) => id === selectedChoiceId);
    if (!choice) throw new BadRequestException('Selected choice does not belong to this question.');

    const now = new Date();
    const timeSpentSec = item.lastDisplayedAt
      ? Math.max(0, Math.floor((now.getTime() - item.lastDisplayedAt.getTime()) / 1000))
      : 0;
    const isCorrect = choice.isCorrect;
    const pointsAwarded = isCorrect ? 10 : 0;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.studySessionQuestion.update({
        where: { id: item.id },
        data: {
          status: isCorrect ? 'CORRECT' : 'UNANSWERED',
          lastDisplayedAt: now,
          totalTimeSpentSec: { increment: timeSpentSec },
          attemptCount: { increment: 1 },
          pointsAwarded: isCorrect ? pointsAwarded : 0,
          answeredAt: isCorrect ? now : null,
        },
      });
      await tx.studyAnswerAttempt.create({
        data: {
          sessionQuestionId: item.id,
          selectedChoiceId,
          isCorrect,
          timeSpentSec,
        },
      });

      const remaining = await tx.studySessionQuestion.count({
        where: { sessionId, status: 'UNANSWERED' },
      });
      const sessionCompleted = remaining === 0;
      if (sessionCompleted) {
        await tx.studySession.update({
          where: { id: sessionId },
          data: { status: 'COMPLETED', completedAt: now },
        });
      }

      const correctChoice = isCorrect ? item.question.choices.find((candidate) => candidate.isCorrect) : null;
      return {
        questionId: item.questionId,
        isCorrect,
        status: updated.status,
        attemptCount: updated.attemptCount,
        timeSpentSec,
        pointsAwarded,
        sessionCompleted,
        ...(isCorrect
          ? {
              correctChoice: correctChoice ? { id: correctChoice.id, letter: correctChoice.letter, text: correctChoice.text } : null,
              explanation: item.question.explanation,
            }
          : { message: 'This option is incorrect. Try again.' }),
      };
    });
  }

  private shuffle<T>(items: T[]) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }
    return shuffled;
  }
}
