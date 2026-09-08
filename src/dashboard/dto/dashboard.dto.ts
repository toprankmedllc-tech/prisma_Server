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

  @ApiProperty({ description: 'Burnout score on a 0-100 scale (higher = more burnout risk)' })
  burnoutScore!: number;

  @ApiProperty()
  recommendation!: string;

  @ApiProperty({ type: [String], description: 'Actionable tips to reduce burnout' })
  tips!: string[];

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
  @ApiProperty({ description: 'Organ system / subject name (e.g. Cardiology, Neurology)' })
  systemName!: string;

  @ApiProperty({ description: 'Proficiency percentage (0-100), or null if no data' })
  percentage!: number | null;
}

export class DailyActivityPatternDto {
  @ApiProperty({ description: 'Date (YYYY-MM-DD)' })
  date!: string;

  @ApiProperty({ description: 'Daily accuracy score (0-100), or null if no activity that day' })
  score!: number | null;
}

export class StreakInfoDto {
  @ApiProperty({ description: 'Current streak in days' })
  current!: number;

  @ApiProperty({ description: 'Longest streak in days' })
  longest!: number;

  @ApiProperty({ description: 'Date of the last active day (YYYY-MM-DD) or null' })
  lastActiveDate!: string | null;

  @ApiProperty({ description: 'Whether the streak is still alive today' })
  isActiveToday!: boolean;
}

export class ExamReadinessDto {
  @ApiProperty()
  scoreForecast!: ScoreForecastDto;

  @ApiProperty()
  burnoutAnalysis!: BurnoutAnalysisDto;

  @ApiProperty()
  knowledgeHeatmap!: KnowledgeHeatmapDto[];

  @ApiProperty({ type: [DailyActivityPatternDto], description: 'Daily accuracy pattern over the last 7 days' })
  dailyActivityPatterns!: DailyActivityPatternDto[];

  @ApiProperty({ description: 'Current and longest study streaks' })
  streaks!: StreakInfoDto;

  @ApiProperty()
  overallReadiness!: number; // 0-100 scale

  @ApiProperty({ description: 'Convenience top-level burnout score (0-100)' })
  burnoutScore!: number;

  @ApiProperty({ description: 'Convenience top-level burnout risk level' })
  burnoutRisk!: 'LOW' | 'MEDIUM' | 'HIGH';
}
