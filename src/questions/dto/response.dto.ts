import { Difficulty, QuestionSource, QuestionSourceType, CognitiveLevel } from '@prisma/client';

// export class TopicResponseDto {
//     id!: string;
//     name!: string;
//     subjectId!: string;
//     questionCount?: number;
// }

export class SubjectResponseDto {
    id!: string;
    name!: string;
    description!: string | null;
    // topics!: TopicResponseDto[];
}

export class ChoiceResponseDto {
    id!: string;
    text!: string;
    isCorrect!: boolean;
    order!: number;
}

export class WrongOptionResponseDto {
    id!: string;
    letter!: string;
    text!: string;
    explanation!: string | null;
    buzzwordCombo!: string | null;
    order!: number;
}

export class VitalsResponseDto {
    bloodPressure!: string | null;
    heartRate!: number | null;
    pulseOximetry!: number | null;
    temperature!: number | null;
    respiratoryRate!: number | null;
}

export class QualityReviewResponseDto {
    id!: string;
    medicalAccuracy!: string | null;
    usmleStyle!: string | null;
    explanationQuality!: string | null;
    originality!: string | null;
    grammar!: string | null;
    vignetteReview!: string | null;
    buzzwordReview!: string | null;
    reviewedBy!: string | null;
    reviewedAt!: Date;
}

export class QuestionResponseDto {
    id!: string;
    stem!: string;
    explanation!: string;
    difficulty!: Difficulty;
    source!: QuestionSource;
    topicId!: string;
    choices!: ChoiceResponseDto[];
    tags!: string[];
    isPublished!: boolean;
    createdAt!: Date;
}

export class ReviewDashboardItemDto {
    id!: string;
    stem!: string;
    sourceType!: QuestionSourceType | null;
    difficulty!: Difficulty;
    reviewed!: boolean;
    rejected!: boolean;
    isPublished!: boolean;
    createdAt!: Date;
    topic!: {
        id: string;
        name: string;
        subject: { id: string; name: string };
    };
}

export class QuestionDetailDto {
    id!: string;
    stem!: string;
    leadInQuestion!: string | null;
    explanation!: string;
    source!: QuestionSource;
    sourceType!: QuestionSourceType | null;
    sourceRow!: number | null;
    sourceFile!: string | null;
    qid!: string | null;
    topicId!: string;
    system!: string | null;
    discipline!: string | null;
    subsystem!: string | null;
    cognitiveLevel!: CognitiveLevel | null;
    difficulty!: Difficulty;
    trapType!: string | null;
    patientProfile!: string | null;
    chiefComplaint!: string | null;
    keySymptoms!: string[];
    physicalExam!: string | null;
    mainClue!: string | null;
    supportingClue!: string | null;
    correctAnswerLetter!: string | null;
    correctAnswerText!: string | null;
    stepByStepReasoning!: string | null;
    educationalObjective!: string | null;
    buzzwords!: string[];
    buzzwordCombinationCorrect!: string | null;
    relatedConcepts!: string[];
    suggestedImages!: string | null;
    importedAt!: Date | null;
    importedBy!: string | null;
    isPublished!: boolean;
    reviewed!: boolean;
    rejected!: boolean;
    reviewedBy!: string | null;
    reviewNotes!: Record<string, any> | null;
    createdAt!: Date;
    updatedAt!: Date;
    topic!: {
        id: string;
        name: string;
        subject: { id: string; name: string };
    };
    choices!: ChoiceResponseDto[];
    wrongOptions!: WrongOptionResponseDto[];
    vitals!: VitalsResponseDto | null;
    qualityReview!: QualityReviewResponseDto | null;
    tags!: string[];
}

export class GenerateQuestionsResponseDto {
    success!: boolean;
    message!: string;
    questions!: QuestionResponseDto[];
    tokenUsage?: {
        prompt: number;
        completion: number;
        total: number;
    };
}