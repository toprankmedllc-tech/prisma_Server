import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { Difficulty } from '@prisma/client';

export class CreateMockExamDto {
  @ApiPropertyOptional({ example: 'My Cardiology Mock Exam' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Practice exam for cardiology' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: ['Cardiology'], description: 'Subject names used to select questions' })
  @IsArray()
  @IsString({ each: true })
  subjects!: string[];

  @ApiProperty({ enum: Difficulty, isArray: true, example: ['EASY', 'MEDIUM', 'HARD'] })
  @IsArray()
  @IsEnum(Difficulty, { each: true })
  difficulties!: Difficulty[];

  @ApiProperty({ example: 3, minimum: 1, maximum: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  blockCount!: number;

  @ApiProperty({ example: 20, description: 'Question attempt limit per block', minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  questionsPerBlock!: number;

  @ApiProperty({ example: 90, description: 'Seconds allowed for each question', minimum: 10, maximum: 600 })
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(600)
  secondsPerQuestion!: number;
}

export class MockChatMessageDto {
  role!: 'user' | 'assistant';
  content!: string;
}

export class MockChatDto {
  @IsString()
  attemptId!: string;

  @IsString()
  questionId!: string;

  @IsString()
  message!: string;

  @IsOptional()
  messages?: MockChatMessageDto[];

  @IsOptional()
  @IsString()
  selectedText?: string;
}

export class MockTipDto {
  @IsString()
  attemptId!: string;

  @IsString()
  questionId!: string;
}

export class SubmitMockAnswerDto {
  @ApiPropertyOptional({ example: 'choice-id' })
  @IsOptional()
  @IsString()
  selectedChoiceId?: string;

  @ApiPropertyOptional({ example: 42, description: 'Client-reported elapsed seconds; server timer remains authoritative' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  timeSpentSec?: number;
}
