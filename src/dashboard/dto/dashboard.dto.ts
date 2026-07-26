import { ApiProperty } from '@nestjs/swagger';

export enum OrganSystem {
  CARDIOVASCULAR = 'CARDIOVASCULAR',
  RESPIRATORY = 'RESPIRATORY',
  GASTROINTESTINAL = 'GASTROINTESTINAL',
  HEPATOBILIARY = 'HEPATOBILIARY',
  KIDNEY_URINARY = 'KIDNEY_URINARY',
  NEUROLOGY = 'NEUROLOGY',
  ENDOCRINE = 'ENDOCRINE',
  HEMATOLOGIC = 'HEMATOLOGIC',
  MUSCULOSKELETAL = 'MUSCULOSKELETAL',
  PSYCHIATRY = 'PSYCHIATRY',
  INFECTIOUS_DISEASE = 'INFECTIOUS_DISEASE',
  ONCOLOGY = 'ONCOLOGY',
  EMERGENCY_MEDICINE = 'EMERGENCY_MEDICINE',
  FAMILY_MEDICINE = 'FAMILY_MEDICINE',
}

export class ScoreForecastDto {
  @ApiProperty()
  predictedScore!: number;

  @ApiProperty()
  confidenceInterval!: {
    lower: number;
    upper: number;
  };

  @ApiProperty()
  trend!: 'IMPROVING' | 'DECLINING' | 'STABLE';

  @ApiProperty()
  lastUpdated!: Date;
}

export class BurnoutAnalysisDto {
  @ApiProperty()
  burnoutRisk!: 'LOW' | 'MEDIUM' | 'HIGH';

  @ApiProperty()
  recommendation!: string;

  @ApiProperty()
  metrics!: {
    avgResponseTime: number;
    errorRateTrend: number;
    sessionDuration: number;
  };

  @ApiProperty()
  lastUpdated!: Date;
}

export class KnowledgeHeatmapDto {
  @ApiProperty()
  organSystem!: OrganSystem;

  @ApiProperty()
  proficiency!: number; // 0-100 scale

  @ApiProperty()
  lastAssessed!: Date;
}

export class ExamReadinessDto {
  @ApiProperty()
  scoreForecast!: ScoreForecastDto;

  @ApiProperty()
  burnoutAnalysis!: BurnoutAnalysisDto;

  @ApiProperty()
  knowledgeHeatmap!: KnowledgeHeatmapDto[];

  @ApiProperty()
  overallReadiness!: number; // 0-100 scale
}
