import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTeamBattleDto,
  SubmitTeamAnswerDto,
  TeamBattleDto,
} from './dto/guild.dto';

const DEFAULT_QUESTION_COUNT = 5;
const DEFAULT_DURATION_SEC = 300;
const TEAM_SIZE = 4;

@Injectable()
export class TeamBattleService {
  private readonly logger = new Logger(TeamBattleService.name);

  constructor(private prisma: PrismaService) {}

  // ============================================
  // CREATE A TEAM BATTLE (4v4)
  // ============================================
  async createTeamBattle(userId: string, dto: CreateTeamBattleDto): Promise<TeamBattleDto> {
    const teammateIds = (dto.teammateIds || []).slice(0, TEAM_SIZE - 1); // max 3 teammates
    const teamAIds = [userId, ...teammateIds];

    // Validate teammates exist.
    if (teammateIds.length > 0) {
      const teammates = await this.prisma.user.findMany({
        where: { id: { in: teammateIds } },
        select: { id: true },
      });
      if (teammates.length !== teammateIds.length) {
        throw new BadRequestException('One or more teammates were not found.');
      }
    }

    const questionCount = dto.questionCount || DEFAULT_QUESTION_COUNT;
    const durationSec = dto.durationSec || DEFAULT_DURATION_SEC;

    // Pick random published questions.
    const questions = await this.prisma.question.findMany({
      where: { isPublished: true },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: questionCount * 3,
    });
    if (questions.length === 0) {
      throw new BadRequestException('No published questions available for a battle.');
    }
    const shuffled = this.shuffleArray(questions.map((q) => q.id)).slice(0, questionCount);

    // Create the team battle with Team A members.
    const battle = await this.prisma.arenaTeamBattle.create({
      data: {
        teamAId: userId,
        teamBId: '', // placeholder; opponent team joins later
        status: 'IN_PROGRESS',
        durationSec,
        startedAt: new Date(),
        members: {
          create: teamAIds.map((id) => ({ userId: id, teamId: 'A' })),
        },
        questions: {
          create: shuffled.map((questionId, index) => ({ questionId, order: index })),
        },
      },
      include: {
        members: { include: { user: true } },
        questions: { include: { question: { include: { choices: { orderBy: { order: 'asc' } } } } } },
      },
    });

    return this.toTeamBattleDto(battle);
  }

  // ============================================
  // GET A TEAM BATTLE
  // ============================================
  async getTeamBattle(battleId: string): Promise<TeamBattleDto> {
    const battle = await this.prisma.arenaTeamBattle.findUnique({
      where: { id: battleId },
      include: {
        members: { include: { user: true } },
        questions: {
          orderBy: { order: 'asc' },
          include: { question: { include: { choices: { orderBy: { order: 'asc' } } } } },
        },
      },
    });
    if (!battle) throw new NotFoundException(`Team battle with ID "${battleId}" not found`);
    return this.toTeamBattleDto(battle);
  }

  // ============================================
  // JOIN A TEAM BATTLE (as Team B)
  // ============================================
  async joinTeamBattle(userId: string, battleId: string): Promise<TeamBattleDto> {
    const battle = await this.prisma.arenaTeamBattle.findUnique({
      where: { id: battleId },
      include: { members: true },
    });
    if (!battle) throw new NotFoundException(`Team battle with ID "${battleId}" not found`);
    if (battle.status !== 'IN_PROGRESS') throw new BadRequestException('This battle is not open.');

    // Check the user isn't already in it.
    const alreadyIn = battle.members.some((m) => m.userId === userId);
    if (alreadyIn) throw new BadRequestException('You are already in this battle.');

    // Count Team B members; max 4.
    const teamBCount = battle.members.filter((m) => m.teamId === 'B').length;
    if (teamBCount >= TEAM_SIZE) {
      throw new BadRequestException('Team B is full.');
    }

    await this.prisma.arenaTeamBattleMember.create({
      data: { battleId, userId, teamId: 'B' },
    });

    return this.getTeamBattle(battleId);
  }

  // ============================================
  // SUBMIT A TEAM ANSWER (any member can answer)
  // ============================================
  async submitTeamAnswer(userId: string, battleId: string, dto: SubmitTeamAnswerDto) {
    const battle = await this.prisma.arenaTeamBattle.findUnique({
      where: { id: battleId },
      include: {
        members: true,
        questions: { include: { question: { include: { choices: true } } } },
      },
    });
    if (!battle) throw new NotFoundException(`Team battle with ID "${battleId}" not found`);
    if (battle.status !== 'IN_PROGRESS') throw new BadRequestException('This battle is not in progress.');

    const membership = battle.members.find((m) => m.userId === userId);
    if (!membership) throw new BadRequestException('You are not part of this battle.');
    const teamId = membership.teamId;

    const battleQuestion = battle.questions.find((q) => q.questionId === dto.questionId);
    if (!battleQuestion) throw new BadRequestException('Question is not part of this battle.');

    // Prevent the same user double-answering.
    const existing = await this.prisma.arenaTeamBattleAnswer.findUnique({
      where: { battleId_questionId_userId: { battleId, questionId: dto.questionId, userId } },
    });
    if (existing) throw new BadRequestException('You have already answered this question.');

    const choice = dto.selectedChoiceId
      ? battleQuestion.question.choices.find((c) => c.id === dto.selectedChoiceId)
      : undefined;
    if (dto.selectedChoiceId && !choice) throw new BadRequestException('Selected choice does not belong to this question.');

    const isCorrect = choice?.isCorrect === true;

    await this.prisma.arenaTeamBattleAnswer.create({
      data: {
        battleId,
        questionId: dto.questionId,
        userId,
        teamId,
        selectedChoiceId: dto.selectedChoiceId || null,
        isCorrect,
        timeSpentSec: dto.timeSpentSec || 0,
      },
    });

    // Award points to the whole team.
    await this.prisma.arenaTeamBattle.update({
      where: { id: battleId },
      data: teamId === 'A'
        ? { teamAScore: { increment: isCorrect ? 1 : 0 } }
        : { teamBScore: { increment: isCorrect ? 1 : 0 } },
    });

    return {
      id: battleId,
      teamId,
      questionId: dto.questionId,
      isCorrect,
      correctChoiceId: isCorrect ? undefined : battleQuestion.question.choices.find((c) => c.isCorrect)?.id,
    };
  }

  // ============================================
  // COMPLETE A TEAM BATTLE + AWARD DIAMONDS
  // ============================================
  async completeTeamBattle(userId: string, battleId: string) {
    const battle = await this.prisma.arenaTeamBattle.findUnique({
      where: { id: battleId },
      include: { members: true },
    });
    if (!battle) throw new NotFoundException(`Team battle with ID "${battleId}" not found`);
    if (battle.status !== 'IN_PROGRESS') throw new BadRequestException('This battle is already completed.');

    const isMember = battle.members.some((m) => m.userId === userId);
    if (!isMember) throw new BadRequestException('You are not part of this battle.');

    let winnerTeamId: string | null = null;
    if (battle.teamAScore > battle.teamBScore) winnerTeamId = 'A';
    else if (teamBScore(battle) > battle.teamAScore) winnerTeamId = 'B';

    await this.prisma.arenaTeamBattle.update({
      where: { id: battleId },
      data: { status: 'COMPLETED', winnerTeamId, completedAt: new Date() },
    });

    // Award diamonds to the winning team members.
    const DIAMOND_REWARD = 5;
    if (winnerTeamId) {
      const winners = battle.members.filter((m) => m.teamId === winnerTeamId);
      for (const winner of winners) {
        await this.prisma.user.update({
          where: { id: winner.userId },
          data: { diamonds: { increment: DIAMOND_REWARD } },
        });
      }
    }

    return {
      id: battle.id,
      status: 'COMPLETED',
      winnerTeamId,
      teamAScore: battle.teamAScore,
      teamBScore: battle.teamBScore,
      diamondReward: winnerTeamId ? DIAMOND_REWARD : 0,
    };
  }

  // ============================================
  // HELPERS
  // ============================================
  private toTeamBattleDto(battle: any): TeamBattleDto {
    return {
      id: battle.id,
      teamAId: battle.teamAId,
      teamBId: battle.teamBId,
      status: battle.status,
      durationSec: battle.durationSec,
      teamAScore: battle.teamAScore,
      teamBScore: battle.teamBScore,
      winnerTeamId: battle.winnerTeamId,
      startedAt: battle.startedAt,
      completedAt: battle.completedAt,
      members: battle.members.map((m: any) => ({
        userId: m.userId,
        teamId: m.teamId,
        name: `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || 'Anonymous',
      })),
      questions: battle.questions.map((bq: any) => ({
        questionId: bq.questionId,
        order: bq.order,
        stem: bq.question.stem,
        explanation: bq.question.explanation,
        difficulty: bq.question.difficulty,
        choices: bq.question.choices.map((c: any) => ({
          id: c.id,
          letter: c.letter,
          text: c.text,
          order: c.order,
        })),
      })),
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

function teamBScore(battle: any): number {
  return battle.teamBScore;
}