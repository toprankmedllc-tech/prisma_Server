import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Difficulty } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export enum StudyQuestionType {
  BOTH = 'BOTH',
  BUZZWORD = 'BUZZWORD',
  VIGNETTE = 'VIGNETTE',
}

export class CreateStudySessionDto {
  @ApiProperty({ example: 'Cardiology review' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ example: 'Focus on heart failure and arrhythmias.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ enum: StudyQuestionType, default: StudyQuestionType.BOTH })
  @IsEnum(StudyQuestionType)
  questionType: StudyQuestionType = StudyQuestionType.BOTH;

  @ApiPropertyOptional({ enum: Difficulty, isArray: true })
  @IsOptional()
  @IsEnum(Difficulty, { each: true })
  difficulties?: Difficulty[];

  @ApiPropertyOptional({ enum: Difficulty })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjectIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class SubmitStudyAnswerDto {
  @ApiProperty({ example: 'choice-id' })
  @IsString()
  selectedChoiceId!: string;
}
