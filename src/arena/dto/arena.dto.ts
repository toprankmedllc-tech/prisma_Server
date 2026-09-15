import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ArenaBattleMode } from '@prisma/client';

// ============================================
// REQUEST DTOs
// ============================================
export class CreateArenaBattleDto {
  @ApiProperty({ description: 'Opponent user ID' })
  @IsString()
  opponentId!: string;

  @ApiPropertyOptional({ enum: ArenaBattleMode, default: 'HEAD_TO_HEAD' })
  @IsOptional()
  @IsEnum(ArenaBattleMode)
  mode?: ArenaBattleMode;

  @ApiPropertyOptional({ description: 'Number of questions for the battle', default: 5, minimum: 1, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  questionCount?: number;

  @ApiPropertyOptional({ description: 'Battle duration in seconds', default: 300, minimum: 30, maximum: 3600 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(3600)
  durationSec?: number;
}

export class SubmitArenaAnswerDto {
  @ApiProperty({ description: 'Question ID being answered' })
  @IsString()
  questionId!: string;

  @ApiPropertyOptional({ description: 'Selected choice ID' })
  @IsOptional()
  @IsString()
  selectedChoiceId?: string;

  @ApiPropertyOptional({ description: 'Time spent in seconds' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  timeSpentSec?: number;
}

// ============================================
// RESPONSE DTOs
// ============================================
export class ArenaBattleQuestionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  questionId!: string;

  @ApiProperty()
  order!: number;

  @ApiProperty()
  stem!: string;

  @ApiProperty()
  explanation!: string;

  @ApiProperty()
  difficulty!: string;

  @ApiProperty({ type: [Object], description: 'Choices (isCorrect stripped for the opponent)' })
  choices!: Array<{ id: string; letter: string | null; text: string; order: number }>;
}

export class ArenaBattleDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  player1Id!: string;

  @ApiProperty()
  player2Id!: string;

  @ApiProperty()
  mode!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  durationSec!: number;

  @ApiProperty()
  player1Score!: number;

  @ApiProperty()
  player2Score!: number;

  @ApiPropertyOptional()
  winnerId!: string | null;

  @ApiPropertyOptional()
  startedAt!: Date | null;

  @ApiPropertyOptional()
  completedAt!: Date | null;

  @ApiProperty({ type: [ArenaBattleQuestionDto] })
  questions!: ArenaBattleQuestionDto[];
}

export class ArenaLeaderboardEntryDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  wins!: number;

  @ApiProperty()
  losses!: number;

  @ApiProperty()
  draws!: number;

  @ApiProperty()
  points!: number;

  @ApiProperty()
  currentStreak!: number;

  @ApiProperty()
  longestStreak!: number;
}

export class ArenaStatsDto {
  @ApiProperty()
  wins!: number;

  @ApiProperty()
  losses!: number;

  @ApiProperty()
  draws!: number;

  @ApiProperty()
  points!: number;

  @ApiProperty()
  currentStreak!: number;

  @ApiProperty()
  longestStreak!: number;

  @ApiProperty()
  battlesPlayed!: number;
}