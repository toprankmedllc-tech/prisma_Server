import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';
import { Difficulty } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ExamType {
    USMLE_STEP_1 = 'USMLE_STEP_1',
    USMLE_STEP_2_CK = 'USMLE_STEP_2_CK',
    USMLE_STEP_3 = 'USMLE_STEP_3',
}

export enum QuestionSourceType {
    BUZZWORD = 'BUZZWORD',
    VIGNETTE = 'VIGNETTE',
}

export class GenerateQuestionsDto {
    @ApiProperty({ description: 'Number of questions to generate (1-20)' })
    @IsInt()
    @Min(1)
    @Max(20)
    count!: number;

    @ApiProperty({ description: 'Medical topic for the questions (e.g. "Narcolepsy", "Graves disease")' })
    @IsString()
    topic!: string;

    @ApiPropertyOptional({ description: 'Subject area (e.g. "Clinical Medicine", "Pathology")' })
    @IsOptional()
    @IsString()
    subject?: string;

    @ApiPropertyOptional({ description: 'Discipline (e.g. "Physiology", "Pharmacology", "Pathology")' })
    @IsOptional()
    @IsString()
    discipline?: string;

    @ApiProperty({ description: 'Question type: BUZZWORD (short, keyword-driven) or VIGNETTE (clinical scenario)' })
    @IsEnum(QuestionSourceType)
    sourceType!: QuestionSourceType;

    @ApiProperty({ enum: ['USMLE_STEP_1', 'USMLE_STEP_2_CK', 'USMLE_STEP_3'] })
    @IsEnum(ExamType)
    examType!: ExamType;

    @ApiProperty({ enum: ['EASY', 'MEDIUM', 'HARD'] })
    @IsEnum(Difficulty)
    difficulty!: Difficulty;

    @ApiPropertyOptional({ description: 'Include a full clinical patient presentation (age, history, exam, vitals)' })
    @IsOptional()
    @IsBoolean()
    clinicalRepresentation?: boolean;
}


export class ImportQuestionsDto {
    @ApiProperty({ type: 'string', format: 'binary' })
    file: any;

    @ApiPropertyOptional({ enum: ['BUZZWORD', 'VIGNETTE'] })
    @IsOptional()
    @IsString()
    sourceType?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    sourceFile?: string;
}


export class FindAllQuestionsDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    topic?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    topicId?: string;

    @ApiPropertyOptional({ enum: ['EASY', 'MEDIUM', 'HARD'] })
    @IsOptional()
    @IsString()
    difficulty?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    source?: string;

    @ApiPropertyOptional({ enum: ['BUZZWORD', 'VIGNETTE'] })
    @IsOptional()
    @IsString()
    sourceType?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    system?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    discipline?: string;

    @ApiPropertyOptional({ enum: ['RECALL', 'APPLICATION', 'CLINICAL_REASONING', 'ANALYSIS'] })
    @IsOptional()
    @IsString()
    cognitiveLevel?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    trapType?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    tag?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isPublished?: boolean;

    @ApiPropertyOptional({ example: 0 })
    @IsOptional()
    @IsNumber()
    skip?: number;

    @ApiPropertyOptional({ example: 50 })
    @IsOptional()
    @IsNumber()
    take?: number;

    @ApiPropertyOptional({ enum: ['createdAt', 'difficulty', 'sourceType', 'topic'] })
    @IsOptional()
    @IsString()
    sortBy?: string;

    @ApiPropertyOptional({ enum: ['asc', 'desc'] })
    @IsOptional()
    @IsString()
    sortOrder?: 'asc' | 'desc';
}
// ============================================
// Question edit DTO
// ============================================

export class UpdateQuestionDto {
    @IsOptional() @IsString() stem?: string;
    @IsOptional() @IsString() leadInQuestion?: string | null;
    @IsOptional() @IsString() explanation?: string;
    @IsOptional() @IsString() topicId?: string;
    @IsOptional() @IsEnum(Difficulty) difficulty?: Difficulty;
    @IsOptional() @IsString() sourceType?: QuestionSourceType;
    @IsOptional() @IsString() system?: string | null;
    @IsOptional() @IsString() discipline?: string | null;
    @IsOptional() @IsString() patientProfile?: string | null;
    @IsOptional() @IsString() chiefComplaint?: string | null;
    @IsOptional() @IsArray() @IsString({ each: true }) keySymptoms?: string[];
    @IsOptional() @IsString() physicalExam?: string | null;
    @IsOptional() @IsString() mainClue?: string | null;
    @IsOptional() @IsString() supportingClue?: string | null;
    @IsOptional() @IsString() correctAnswerLetter?: string | null;
    @IsOptional() @IsString() correctAnswerText?: string | null;
    @IsOptional() @IsString() stepByStepReasoning?: string | null;
    @IsOptional() @IsString() educationalObjective?: string | null;
    @IsOptional() @IsArray() @IsString({ each: true }) buzzwords?: string[];
    @IsOptional() @IsString() buzzwordCombinationCorrect?: string | null;
    @IsOptional() @IsArray() @IsString({ each: true }) relatedConcepts?: string[];
    @IsOptional() @IsString() suggestedImages?: string | null;
    @IsOptional() @IsArray() choices?: Array<{ id?: string; text: string; isCorrect: boolean; order?: number }>;
    @IsOptional() @IsArray() wrongOptions?: Array<{ letter: string; text: string; explanation?: string | null; buzzwordCombo?: string | null; order?: number }>;
    @IsOptional() @IsObject() vitals?: { bloodPressure?: string | null; heartRate?: number | null; pulseOximetry?: number | null; temperature?: number | null; respiratoryRate?: number | null } | null;
    @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
    @IsString() reason!: string;
}

// ============================================
// Review DTOs
// ============================================

export class ReviewQuestionDto {
    // @ApiProperty({ description: 'Set true to mark the question as reviewed' })
    // @IsBoolean()
    // reviewed!: boolean;

    @ApiPropertyOptional({ description: 'Set true to reject the question. If approved, set to false.' })
    @IsOptional()
    @IsBoolean()
    rejected?: boolean;

    // @ApiPropertyOptional({ description: 'User ID of the reviewer (for audit trail)' })
    // @IsOptional()
    // @IsString()
    // reviewedBy?: string;

    @ApiPropertyOptional({
        description: 'Attribute-level review notes. Keys can be any question field (stem, leadInQuestion, explanation, choices, correctAnswer, medicalAccuracy, usmleStyle, explanationQuality, originality, grammar, vignetteReview, buzzwordReview, generalNotes, etc.)',
        example: {
            stem: 'The stem is well-written.',
            choices: { 'choice-id-1': 'This distracter is too obvious.' },
            explanation: 'Needs more detail about the mechanism.',
            generalNotes: 'Overall good question, minor fixes needed.',
        },
    })
    @IsOptional()
    @IsObject()
    reviewNotes?: Record<string, any>;
}

// ============================================
// Quality Review DTO
// ============================================

export class CreateQualityReviewDto {
    @ApiPropertyOptional({ description: 'Rating/feedback on medical accuracy' })
    @IsOptional()
    @IsString()
    medicalAccuracy?: string;

    @ApiPropertyOptional({ description: 'Rating/feedback on USMLE style alignment' })
    @IsOptional()
    @IsString()
    usmleStyle?: string;

    @ApiPropertyOptional({ description: 'Rating/feedback on explanation quality' })
    @IsOptional()
    @IsString()
    explanationQuality?: string;

    @ApiPropertyOptional({ description: 'Rating/feedback on originality' })
    @IsOptional()
    @IsString()
    originality?: string;

    @ApiPropertyOptional({ description: 'Rating/feedback on grammar' })
    @IsOptional()
    @IsString()
    grammar?: string;

    @ApiPropertyOptional({ description: 'Rating/feedback on vignette (for vignette-type questions)' })
    @IsOptional()
    @IsString()
    vignetteReview?: string;

    @ApiPropertyOptional({ description: 'Rating/feedback on buzzword usage (for buzzword-type questions)' })
    @IsOptional()
    @IsString()
    buzzwordReview?: string;

    @ApiPropertyOptional({ description: 'User ID of the quality reviewer (for audit trail)' })
    @IsOptional()
    @IsString()
    reviewedBy?: string;
}

// ============================================
// Unpublish by Discipline DTO
// ============================================

export class UnpublishByDisciplineDto {
    @ApiProperty({ description: 'Discipline name to unpublish all questions for (e.g. Cardiology, Neurology)' })
    @IsString()
    discipline!: string;
}

