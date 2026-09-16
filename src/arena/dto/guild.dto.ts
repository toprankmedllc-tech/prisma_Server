import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// ============================================
// GUILD REQUEST DTOs
// ============================================
export class CreateGuildDto {
  @ApiProperty({ description: 'Guild name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Guild description' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class InviteToGuildDto {
  @ApiProperty({ description: 'User ID or email of the person to invite' })
  @IsString()
  invitee!: string;
}

export class VoteForLeaderDto {
  @ApiProperty({ description: 'Candidate user ID to vote for as guild leader' })
  @IsString()
  candidateId!: string;
}

export class SetCompetitionSquadDto {
  @ApiProperty({ description: 'Array of member user IDs to select for the competition squad' })
  @IsArray()
  @IsString({ each: true })
  memberIds!: string[];
}

// ============================================
// TEAM BATTLE REQUEST DTOs
// ============================================
export class CreateTeamBattleDto {
  @ApiPropertyOptional({ description: 'Array of teammate user IDs (up to 3) to form a 4-person team' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teammateIds?: string[];

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

export class SubmitTeamAnswerDto {
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
export class GuildMemberDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  inCompetitionSquad!: boolean;

  @ApiProperty()
  points!: number;

  @ApiProperty()
  wins!: number;
}

export class GuildDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiPropertyOptional()
  leaderId!: string | null;

  @ApiProperty()
  points!: number;

  @ApiProperty({ type: [GuildMemberDto] })
  members!: GuildMemberDto[];
}

export class TeamBattleDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  teamAId!: string;

  @ApiProperty()
  teamBId!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  durationSec!: number;

  @ApiProperty()
  teamAScore!: number;

  @ApiProperty()
  teamBScore!: number;

  @ApiPropertyOptional()
  winnerTeamId!: string | null;

  @ApiPropertyOptional()
  startedAt!: Date | null;

  @ApiPropertyOptional()
  completedAt!: Date | null;

  @ApiProperty({ type: [Object] })
  members!: Array<{ userId: string; teamId: string; name: string }>;

  @ApiProperty({ type: [Object] })
  questions!: Array<{
    questionId: string;
    order: number;
    stem: string;
    explanation: string;
    difficulty: string;
    choices: Array<{ id: string; letter: string | null; text: string; order: number }>;
  }>;
}