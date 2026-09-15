import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateArenaBattleDto,
  SubmitArenaAnswerDto,
  ArenaBattleDto,
  ArenaBattleQuestionDto,
  ArenaLeaderboardEntryDto,
  ArenaStatsDto,
} from './dto/arena.dto';

const DEFAULT_QUESTION_COUNT = 5;
const DEFAULT_DURATION_SEC = 300;

@Injectable()
export class ArenaService {
  private readonly logger = new Logger(ArenaService.name);

  // In-memory matchmaking queue (userId -> queuedAt).
  private readonly matchmakingQueue: Map<string, Date> = new Map();

  constructor(private prisma: PrismaService) {}

  // ============================================
  // CREATE A BATTLE
  // ============================================
  async createBattle(userId: string, dto: CreateArenaBattleDto): Promise<ArenaBattleDto> {
    if (dto.opponentId === userId) {
      throw new BadRequestException('You cannot battle yourself.');
    }

    const opponent = await this.prisma.user.findUnique({ where: { id: dto.opponentId } });
    if (!opponent) {
      throw new NotFoundException(`Opponent with ID "${dto.opponentId}" not found`);
    }

    const questionCount = dto.questionCount || DEFAULT_QUESTION_COUNT;
    const durationSec = dto.durationSec || DEFAULT_DURATION_SEC;

    // Pick random published questions for the battle.
    const questions = await this.prisma.question.findMany({
      where: { isPublished: true },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: questionCount * 3, // fetch extra to allow for shuffling
    });
    if (questions.length === 0) {
      throw new BadRequestException('No published questions available for a battle.');
    }

    const shuffled = this.shuffleArray(questions.map((q) => q.id)).slice(0, questionCount);

    const battle = await this.prisma.arenaBattle.create({
      data: {
        player1Id: userId,
        player2Id: dto.opponentId,
        mode: dto.mode || 'HEAD_TO_HEAD',
        status: 'IN_PROGRESS',
        durationSec,
        startedAt: new Date(),
        questions: {
          create: shuffled.map((questionId, index) => ({
            questionId,
            order: index,
          })),
        },
      },
      include: {
        questions: {
          include: {
            question: {
              include: { choices: { orderBy: { order: 'asc' } } },
            },
          },
        },
      },
    });

    return this.toBattleDto(battle, userId);
  }

  // ============================================
  // MATCHMAKING QUEUE
  // ============================================
  async joinQueue(userId: string): Promise<{ matched: boolean; battle?: ArenaBattleDto }> {
    // If the user is already queued, do nothing.
    if (this.matchmakingQueue.has(userId)) {
      return { matched: false };
    }

    // Look for another queued user to match with.
    const opponentId = [...this.matchmakingQueue.keys()].find((id) => id !== userId);

    if (opponentId) {
      // Remove both from the queue and create a battle.
      this.matchmakingQueue.delete(opponentId);
      this.matchmakingQueue.delete(userId);

      const battle = await this.createBattle(userId, {
        opponentId,
        mode: 'HEAD_TO_HEAD',
        questionCount: DEFAULT_QUESTION_COUNT,
        durationSec: DEFAULT_DURATION_SEC,
      });

      return { matched: true, battle };
    }

    // No opponent yet — add to the queue.
    this.matchmakingQueue.set(userId, new Date());
    return { matched: false };
  }

  leaveQueue(userId: string): void {
    this.matchmakingQueue.delete(userId);
  }

  // ============================================
  // GET A BATTLE
  // ============================================
  async getBattle(userId: string, battleId: string): Promise<ArenaBattleDto> {
    const battle = await this.prisma.arenaBattle.findUnique({
      where: { id: battleId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: {
            question: {
              include: { choices: { orderBy: { order: 'asc' } } },
            },
          },
        },
      },
    });

    if (!battle) throw new NotFoundException(`Battle with ID "${battleId}" not found`);
    if (battle.player1Id !== userId && battle.player2Id !== userId) {
      throw new BadRequestException('You are not a participant in this battle.');
    }

    return this.toBattleDto(battle, userId);
  }

  // ============================================
  // SUBMIT AN ANSWER
  // ============================================
  async submitAnswer(userId: string, battleId: string, dto: SubmitArenaAnswerDto) {
    const battle = await this.prisma.arenaBattle.findUnique({
      where: { id: battleId },
      include: {
        questions: {
          include: { question: { include: { choices: true } } },
        },
      },
    });

    if (!battle) throw new NotFoundException(`Battle with ID "${battleId}" not found`);
    if (battle.status !== 'IN_PROGRESS') {
      throw new BadRequestException('This battle is not in progress.');
    }
    if (battle.player1Id !== userId && battle.player2Id !== userId) {
      throw new BadRequestException('You are not a participant in this battle.');
    }

    const battleQuestion = battle.questions.find((q) => q.questionId === dto.questionId);
    if (!battleQuestion) {
      throw new BadRequestException('Question is not part of this battle.');
    }

    // Prevent double-answering the same question.
    const existing = await this.prisma.arenaBattleAnswer.findUnique({
      where: { battleId_questionId_userId: { battleId, questionId: dto.questionId, userId } },
    });
    if (existing) {
      throw new BadRequestException('You have already answered this question.');
    }

    const choice = dto.selectedChoiceId
      ? battleQuestion.question.choices.find((c) => c.id === dto.selectedChoiceId)
      : undefined;
    if (dto.selectedChoiceId && !choice) {
      throw new BadRequestException('Selected choice does not belong to this question.');
    }

    const isCorrect = choice?.isCorrect === true;

    const answer = await this.prisma.arenaBattleAnswer.create({
      data: {
        battleId,
        questionId: dto.questionId,
        userId,
        selectedChoiceId: dto.selectedChoiceId || null,
        isCorrect,
        timeSpentSec: dto.timeSpentSec || 0,
      },
    });

    // Update the player's score and answered count.
    const isPlayer1 = battle.player1Id === userId;
    await this.prisma.arenaBattle.update({
      where: { id: battleId },
      data: isPlayer1
        ? {
            player1Score: { increment: isCorrect ? 1 : 0 },
            player1Answered: { increment: 1 },
          }
        : {
            player2Score: { increment: isCorrect ? 1 : 0 },
            player2Answered: { increment: 1 },
          },
    });

    return {
      id: answer.id,
      questionId: answer.questionId,
      isCorrect,
      correctChoiceId: isCorrect ? undefined : battleQuestion.question.choices.find((c) => c.isCorrect)?.id,
    };
  }

  // ============================================
  // COMPLETE A BATTLE
  // ============================================
  async completeBattle(userId: string, battleId: string) {
    const battle = await this.prisma.arenaBattle.findUnique({ where: { id: battleId } });
    if (!battle) throw new NotFoundException(`Battle with ID "${battleId}" not found`);
    if (battle.status !== 'IN_PROGRESS') {
      throw new BadRequestException('This battle is already completed.');
    }
    if (battle.player1Id !== userId && battle.player2Id !== userId) {
      throw new BadRequestException('You are not a participant in this battle.');
    }

    let winnerId: string | null = null;
    if (battle.player1Score > battle.player2Score) winnerId = battle.player1Id;
    else if (battle.player2Score > battle.player1Score) winnerId = battle.player2Id;

    await this.prisma.arenaBattle.update({
      where: { id: battleId },
      data: { status: 'COMPLETED', winnerId, completedAt: new Date() },
    });

    // Update leaderboard entries for both players.
    await this.updateLeaderboard(battle.player1Id, winnerId, battle.player1Id);
    await this.updateLeaderboard(battle.player2Id, winnerId, battle.player2Id);

    return {
      id: battle.id,
      player1Id: battle.player1Id,
      player2Id: battle.player2Id,
      status: 'COMPLETED',
      winnerId,
      player1Score: battle.player1Score,
      player2Score: battle.player2Score,
    };
  }

  // ============================================
  // LEADERBOARD
  // ============================================
  async getLeaderboard(limit = 50): Promise<ArenaLeaderboardEntryDto[]> {
    const entries = await this.prisma.arenaLeaderboardEntry.findMany({
      orderBy: [{ points: 'desc' }, { wins: 'desc' }],
      take: limit,
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });

    return entries.map((e) => ({
      userId: e.userId,
      name: `${e.user.firstName || ''} ${e.user.lastName || ''}`.trim() || 'Anonymous',
      wins: e.wins,
      losses: e.losses,
      draws: e.draws,
      points: e.points,
      currentStreak: e.currentStreak,
      longestStreak: e.longestStreak,
    }));
  }

  // ============================================
  // MY STATS
  // ============================================
  async getMyStats(userId: string): Promise<ArenaStatsDto> {
    const entry = await this.prisma.arenaLeaderboardEntry.findUnique({
      where: { userId },
    });

    const battlesPlayed = await this.prisma.arenaBattle.count({
      where: {
        OR: [{ player1Id: userId }, { player2Id: userId }],
        status: 'COMPLETED',
      },
    });

    return {
      wins: entry?.wins ?? 0,
      losses: entry?.losses ?? 0,
      draws: entry?.draws ?? 0,
      points: entry?.points ?? 0,
      currentStreak: entry?.currentStreak ?? 0,
      longestStreak: entry?.longestStreak ?? 0,
      battlesPlayed,
    };
  }

  // ============================================
  // HELPERS
  // ============================================
  private async updateLeaderboard(userId: string, winnerId: string | null, playerId: string) {
    const isWin = winnerId === playerId;
    const isDraw = winnerId === null;

    const existing = await this.prisma.arenaLeaderboardEntry.findUnique({ where: { userId } });

    const wins = (existing?.wins ?? 0) + (isWin ? 1 : 0);
    const losses = (existing?.losses ?? 0) + (!isWin && !isDraw ? 1 : 0);
    const draws = (existing?.draws ?? 0) + (isDraw ? 1 : 0);
    const points = (existing?.points ?? 0) + (isWin ? 10 : isDraw ? 5 : 0);
    const currentStreak = isWin ? (existing?.currentStreak ?? 0) + 1 : 0;
    const longestStreak = Math.max(existing?.longestStreak ?? 0, currentStreak);

    await this.prisma.arenaLeaderboardEntry.upsert({
      where: { userId },
      create: { userId, wins, losses, draws, points, currentStreak, longestStreak },
      update: { wins, losses, draws, points, currentStreak, longestStreak },
    });
  }

  private toBattleDto(battle: any, viewerId: string): ArenaBattleDto {
    const questions: ArenaBattleQuestionDto[] = battle.questions.map((bq: any) => ({
      id: bq.id,
      questionId: bq.questionId,
      order: bq.order,
      stem: bq.question.stem,
      explanation: bq.question.explanation,
      difficulty: bq.question.difficulty,
      // Strip isCorrect for the opponent; keep it for the viewer's own questions.
      choices: bq.question.choices.map((c: any) => ({
        id: c.id,
        letter: c.letter,
        text: c.text,
        order: c.order,
      })),
    }));

    return {
      id: battle.id,
      player1Id: battle.player1Id,
      player2Id: battle.player2Id,
      mode: battle.mode,
      status: battle.status,
      durationSec: battle.durationSec,
      player1Score: battle.player1Score,
      player2Score: battle.player2Score,
      winnerId: battle.winnerId,
      startedAt: battle.startedAt,
      completedAt: battle.completedAt,
      questions,
    };
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