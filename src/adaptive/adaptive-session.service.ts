import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdaptiveSessionService {
  constructor(private prisma: PrismaService) {}

  async startSession(userId: string, options?: {
    disciplineId?: string;
    organSystemId?: string;
    preferredTopicIds?: string[];
    adaptivePercentage?: number;
  }) {
    // Get user's weak topics (accuracy < 50%)
    const weakTopics = await this.prisma.$queryRaw`
      SELECT q."topicId", COUNT(*) as total, 
             SUM(CASE WHEN a."isCorrect" = true THEN 1 ELSE 0 END) as correct
      FROM "QuestionAttempt" a
      JOIN "Question" q ON a."questionId" = q.id
      WHERE a."userId" = ${userId}
      GROUP BY q."topicId"
      HAVING COUNT(*) > 0 AND (SUM(CASE WHEN a."isCorrect" = true THEN 1 ELSE 0 END)::float / COUNT(*)) < 0.5
    `;

    const weakTopicIds = (weakTopics as any[]).map((t: any) => t.topicId);

    const session = await this.prisma.adaptiveSession.create({
      data: {
        userId,
        disciplineId: options?.disciplineId,
        organSystemId: options?.organSystemId,
        topicIds: weakTopicIds,
        preferredTopicIds: options?.preferredTopicIds || [],
        adaptivePercentage: options?.adaptivePercentage || 50,
        questionCount: 0,
      },
    });

    return session;
  }

  async getNextQuestion(sessionId: string) {
    const session = await this.prisma.adaptiveSession.findUnique({
      where: { id: sessionId },
      include: { questions: true },
    });

    if (!session || session.status === 'COMPLETED') {
      throw new NotFoundException('Session not found or completed');
    }

    // Get existing question IDs
    const existingQuestionIds = session.questions.map(q => q.questionId);

    // Determine if this should be an adaptive question
    // Adaptive questions come from weak topics
    const isAdaptiveQuestion = session.topicIds.length > 0 && 
      Math.random() * 100 < session.adaptivePercentage;

    let question;

    if (isAdaptiveQuestion) {
      // Get adaptive question from weak topics
      question = await this.prisma.question.findFirst({
        where: {
          topicId: { in: session.topicIds },
          id: { notIn: existingQuestionIds },
          isPublished: true,
          reviewed: true,
        },
        include: { choices: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    // If no adaptive question found or not adaptive turn, get from preferred topics or general
    if (!question) {
      const preferredTopics = [...session.topicIds, ...(session.preferredTopicIds || [])];
      
      question = await this.prisma.question.findFirst({
        where: {
          OR: [
            { topicId: { in: preferredTopics } },
            { disciplineId: session.disciplineId },
            { organSystemId: session.organSystemId },
          ],
          id: { notIn: existingQuestionIds },
          isPublished: true,
          reviewed: true,
        },
        include: { choices: true },
      });
    }

    // Fallback to any available question
    if (!question) {
      question = await this.prisma.question.findFirst({
        where: {
          id: { notIn: existingQuestionIds },
          isPublished: true,
          reviewed: true,
        },
        include: { choices: true },
      });
    }

    if (!question) {
      // No more questions available - complete session
      await this.prisma.adaptiveSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      return null;
    }

    // Create session question
    await this.prisma.adaptiveSessionQuestion.create({
      data: {
        sessionId,
        questionId: question.id,
        order: session.questions.length + 1,
      },
    });

    return question;
  }

  async recordAnswer(sessionId: string, questionId: string, choiceId: string, timeSpentSec: number) {
    // Find the session question by sessionId and questionId
    const sessionQuestion = await this.prisma.adaptiveSessionQuestion.findFirst({
      where: { 
        sessionId,
        questionId,
      },
    });

    if (!sessionQuestion) {
      throw new NotFoundException('Question not found in session');
    }

    const choice = await this.prisma.choice.findUnique({
      where: { id: choiceId },
    });

    const isCorrect = choice?.isCorrect ?? false;

    const attempt = await this.prisma.adaptiveQuestionAttempt.create({
      data: {
        sessionQuestionId: sessionQuestion.id,
        selectedChoiceId: choiceId,
        isCorrect,
        timeSpentSec,
        attemptNumber: 1,
      },
    });

    // Update session question count
    await this.prisma.adaptiveSession.update({
      where: { id: sessionId },
      data: {
        currentQuestionNum: { increment: 1 },
        questionCount: { increment: 1 },
      },
    });

    return attempt;
  }

  async getSessionAnalytics(sessionId: string) {
    const session = await this.prisma.adaptiveSession.findUnique({
      where: { id: sessionId },
      include: {
        questions: {
          include: {
            question: {
              include: { choices: true, topic: true },
            },
            attempts: { orderBy: { answeredAt: 'asc' } },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const totalQuestions = session.questions.length;
    const correctAnswers = session.questions.reduce((acc, sq) => {
      const lastAttempt = sq.attempts[sq.attempts.length - 1];
      return acc + (lastAttempt?.isCorrect ? 1 : 0);
    }, 0);

    const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    // Calculate answer change statistics
    const answerChanges = session.questions.filter(sq => sq.attempts.length > 1).length;

    // Calculate average time per question
    const totalTime = session.questions.reduce((sum, sq) => {
      return sum + sq.attempts.reduce((s, a) => s + a.timeSpentSec, 0);
    }, 0);
    const avgTimePerQuestion = totalQuestions > 0 ? totalTime / totalQuestions : 0;

    return {
      sessionId: session.id,
      totalQuestions,
      correctAnswers,
      accuracy,
      answerChanges,
      avgTimePerQuestion,
      adaptivePercentage: session.adaptivePercentage,
      questions: session.questions.map(sq => ({
        question: sq.question,
        attempts: sq.attempts,
        finalAnswer: sq.attempts[sq.attempts.length - 1]?.selectedChoiceId,
        isCorrect: sq.attempts[sq.attempts.length - 1]?.isCorrect,
        timeSpentSec: sq.attempts.reduce((sum, a) => sum + a.timeSpentSec, 0),
        answerChanged: sq.attempts.length > 1,
      })),
    };
  }
}