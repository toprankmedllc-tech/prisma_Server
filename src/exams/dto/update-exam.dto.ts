import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ExamSelectionSettingsDto } from './create-exam.dto';

export class UpdateExamDto {
  @ApiPropertyOptional({ description: 'Exam title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Exam description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Number of blocks', minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  blockCount?: number;

  @ApiPropertyOptional({ description: 'Questions per block', minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  questionsPerBlock?: number;

  @ApiPropertyOptional({ description: 'Seconds per question', minimum: 10, maximum: 600 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(600)
  secondsPerQuestion?: number;

  @ApiPropertyOptional({ description: 'Enable or disable the exam' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Question selection settings' })
  @IsOptional()
  selectionSettings?: ExamSelectionSettingsDto;
}