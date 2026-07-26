import { Difficulty, QuestionSource } from '@prisma/client';

export class ChoiceResponseDto {
    id!: string;
    text!: string;
    isCorrect!: boolean;
    order!: number;
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