import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsArray, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ExamSelectionSettingsDto {
  @ApiPropertyOptional({ description: 'Filter by subject names' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjects?: string[];

  @ApiPropertyOptional({ description: 'Filter by topic names' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topics?: string[];

  @ApiPropertyOptional({ description: 'Filter by difficulty levels', enum: ['EASY', 'MEDIUM', 'HARD'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  difficulties?: string[];

  @ApiPropertyOptional({ description: 'Filter by source types', enum: ['BUZZWORD', 'VIGNETTE'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourceTypes?: string[];

  @ApiPropertyOptional({ description: 'Only include published questions', default: true })
  @IsOptional()
  @IsBoolean()
  onlyPublished?: boolean;

  @ApiPropertyOptional({ description: 'Filter by exam type (USMLE_STEP_1, USMLE_STEP_2_CK, USMLE_STEP_3)' })
  @IsOptional()
  @IsString()
  examType?: string;
}

export class CreateExamDto {
  @ApiProperty({ description: 'Exam title (e.g., "USMLE Step 1 - Full Length")' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ description: 'Exam description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Number of blocks', default: 8, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  blockCount?: number;

  @ApiPropertyOptional({ description: 'Questions per block', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  questionsPerBlock?: number;

  @ApiPropertyOptional({ description: 'Seconds per question', default: 90, minimum: 10, maximum: 600 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(600)
  secondsPerQuestion?: number;

  @ApiPropertyOptional({ type: ExamSelectionSettingsDto, description: 'Question selection settings for randomizing questions per block' })
  @IsOptional()
  selectionSettings?: ExamSelectionSettingsDto;
}