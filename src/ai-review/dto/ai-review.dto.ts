import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ============================================
// REQUEST DTOs
// ============================================

export class ReviewSingleQuestionDto {
  @ApiProperty({ description: 'Question ID to review' })
  @IsString()
  questionId!: string;
}

export class BatchReviewQuestionsDto {
  @ApiProperty({ description: 'Array of question IDs to review' })
  @IsArray()
  @IsString({ each: true })
  questionIds!: string[];

  @ApiPropertyOptional({ description: 'Auto-publish if PASS (default: true)' })
  @IsOptional()
  @IsBoolean()
  autoPublish?: boolean;

  @ApiPropertyOptional({ description: 'Auto-regenerate if FAIL (default: true)' })
  @IsOptional()
  @IsBoolean()
  autoRegenerate?: boolean;

  @ApiPropertyOptional({ description: 'Use the stringent reviewer model for strict quality gating (default: false)' })
  @IsOptional()
  @IsBoolean()
  stringent?: boolean;
}

export class AiReviewFilterDto {
  @ApiPropertyOptional({ description: 'Filter by source type: BUZZWORD or VIGNETTE' })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional({ description: 'Filter by difficulty' })
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional({ description: 'Filter by source: AI_GENERATED, HUMAN_GENERATED, IMPORTED' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: 'Only unreviewed questions (default: true)' })
  @IsOptional()
  @IsBoolean()
  onlyUnreviewed?: boolean;

  @ApiPropertyOptional({ description: 'Max questions to return (default: 50)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

// ============================================
// RESPONSE DTOs
// ============================================

export class AiReviewScoreDto {
  @ApiProperty()
  medicalAccuracy!: number;

  @ApiProperty()
  hallucinationRisk!: number;

  @ApiProperty()
  usmleStyle!: number;

  @ApiProperty()
  explanationQuality!: number;

  @ApiProperty()
  clinicalRelevance!: number;

  @ApiProperty()
  grammaticalQuality!: number;
}

export class AiReviewFeedbackDto {
  @ApiPropertyOptional()
  usmleStyle?: string;

  @ApiPropertyOptional()
  medicalAccuracy?: string;

  @ApiPropertyOptional()
  hallucinationDetails?: string;

  @ApiPropertyOptional()
  explanationQuality?: string;

  @ApiPropertyOptional()
  clinicalRelevance?: string;

  @ApiPropertyOptional()
  grammatical?: string;

  @ApiPropertyOptional()
  general?: string;
}

export class AiReviewResultDto {
  @ApiProperty({ description: 'AiReview record ID' })
  id!: string;

  @ApiProperty({ description: 'Reviewed question ID' })
  questionId!: string;

  @ApiProperty({ enum: ['PASS', 'FAIL'] })
  verdict!: 'PASS' | 'FAIL';

  @ApiProperty()
  scores!: AiReviewScoreDto;

  @ApiProperty()
  feedback!: AiReviewFeedbackDto;

  @ApiPropertyOptional({ description: 'Model used for review' })
  reviewedByAi?: string;

  @ApiPropertyOptional({ description: 'Tokens used' })
  tokenUsage?: number;

  @ApiPropertyOptional({ description: 'Review duration in ms' })
  reviewDurationMs?: number;

  @ApiPropertyOptional({ description: 'Replacement question ID (if FAIL + auto-regenerate)' })
  replacementQuestionId?: string;

  @ApiPropertyOptional()
  attemptNumber?: number;

  @ApiPropertyOptional()
  trigger?: string;

  @ApiPropertyOptional()
  promptVersion?: string;

  @ApiPropertyOptional()
  humanRejectionContext?: unknown;

  @ApiPropertyOptional()
  criticalIssues?: unknown;

  @ApiPropertyOptional()
  humanAiAgreement?: boolean;

  @ApiProperty()
  createdAt!: Date;
}

export class BatchReviewResultDto {
  @ApiProperty({ description: 'Total questions submitted for review' })
  total: number = 0;

  @ApiProperty({ description: 'Number of questions that PASSED' })
  passed: number = 0;

  @ApiProperty({ description: 'Number of questions that FAILED' })
  failed: number = 0;

  @ApiProperty({ description: 'Number of questions auto-regenerated' })
  regenerated: number = 0;

  @ApiProperty({ description: 'Individual review results' })
  results!: AiReviewResultDto[];
}

export class AiReviewSummaryDto {
  @ApiProperty({ description: 'Total AI reviews performed' })
  totalReviews!: number;

  @ApiProperty({ description: 'Number of PASS verdicts' })
  totalPassed!: number;

  @ApiProperty({ description: 'Number of FAIL verdicts' })
  totalFailed!: number;

  @ApiProperty({ description: 'Average medical accuracy score' })
  avgMedicalAccuracy!: number;

  @ApiProperty({ description: 'Average hallucination risk score' })
  avgHallucinationRisk!: number;

  @ApiProperty({ description: 'Average USMLE style score' })
  avgUsmleStyle!: number;

  @ApiProperty({ description: 'Average explanation quality score' })
  avgExplanationQuality!: number;
}