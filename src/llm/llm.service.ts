import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterProvider, ChatMessage } from './providers/openrouter.provider';
import {
    USMLE_QUESTION_SYSTEM_PROMPT,
    USMLE_QUESTION_USER_PROMPT,
} from './prompts/usmle-question.prompt';

export interface QuestionGenerationInput {
    topic: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    examType: 'USMLE_STEP_1' | 'USMLE_STEP_2_CK' | 'USMLE_STEP_3';
    count: number;
    context: string;
}

export interface GeneratedQuestion {
    questionStem: string;
    answerChoices: string[];
    correctAnswerIndex: number;
    explanation: string;
    topicTags: string[];
    difficulty: string;
}

export interface ChatResponse {
    content: string;
    tokenUsage?: {
        prompt: number;
        completion: number;
        total: number;
    };
}

@Injectable()
export class LLMService {
    private readonly logger = new Logger(LLMService.name);

    constructor(private openRouter: OpenRouterProvider) { }

    async generateUSMLEQuestions(
        input: QuestionGenerationInput,
    ): Promise<GeneratedQuestion[]> {
        // Build the user prompt
        const userPrompt = USMLE_QUESTION_USER_PROMPT
            .replace('{count}', input.count.toString())
            .replace('{topic}', input.topic)
            .replace('{difficulty}', this.formatDifficulty(input.difficulty))
            .replace('{examType}', input.examType.replace('_', ' '))
            .replace('{context}', input.context);

        const messages: ChatMessage[] = [
            { role: 'system', content: USMLE_QUESTION_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
        ];

        this.logger.log(
            `Generating ${input.count} questions on "${input.topic}" at ${input.difficulty} difficulty`,
        );
        this.logger.debug(`User prompt length: ${userPrompt.length} characters`);

        try {
            const response = await this.openRouter.chat(messages, {
                temperature: 0.3,
                maxTokens: 4096,
                jsonMode: true,
            });

            this.logger.log(
                `Token usage - Prompt: ${response.tokenUsage?.prompt || 'N/A'}, Completion: ${response.tokenUsage?.completion || 'N/A'}, Total: ${response.tokenUsage?.total || 'N/A'}`,
            );

            // Parse and validate the response
            const parsed = this.parseResponse(response.content);
            this.validateQuestions(parsed, input.count);

            // Add difficulty to each question if not present
            const questionsWithDifficulty = parsed.map(q => ({
                ...q,
                difficulty: q.difficulty || input.difficulty
            }));

            return questionsWithDifficulty;
        } catch (error: any) {
            this.logger.error(`Failed to generate questions: ${error.message}`);
            if (error.response) {
                this.logger.error(`API Response: ${JSON.stringify(error.response)}`);
            }
            throw new Error(`Question generation failed: ${error.message}`);
        }
    }

    async chat(messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<string> {
        try {
            const response = await this.openRouter.chat(messages, {
                temperature: options?.temperature ?? 0.7,
                maxTokens: options?.maxTokens ?? 2048,
                jsonMode: false,
            });
            return response.content;
        } catch (error: any) {
            this.logger.error(`Chat failed: ${error.message}`);
            throw new Error(`Chat generation failed: ${error.message}`);
        }
    }

    private parseResponse(content: string): GeneratedQuestion[] {
        // Remove any markdown code blocks if present
        let cleanedContent = content.trim();

        // Remove markdown JSON blocks
        if (cleanedContent.startsWith('```json')) {
            cleanedContent = cleanedContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (cleanedContent.startsWith('```')) {
            cleanedContent = cleanedContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        // Try to parse as JSON
        try {
            const parsed = JSON.parse(cleanedContent);

            // Check if response is an object with a questions property
            if (parsed.questions && Array.isArray(parsed.questions)) {
                return parsed.questions;
            }

            // Check if response is a single question object
            if (parsed.questionStem && !Array.isArray(parsed)) {
                return [parsed];
            }

            // Assume it's an array of questions
            if (Array.isArray(parsed)) {
                return parsed;
            }

            throw new Error('Response does not contain valid question format');
        } catch (error: any) {
            // Try to extract JSON array using regex
            const jsonMatch = cleanedContent.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch (e: any) {
                    throw new Error(`Failed to parse JSON from response: ${e.message}`);
                }
            }

            this.logger.error('Raw response that failed to parse:', cleanedContent);
            throw new Error(`Invalid JSON response from LLM: ${error.message}`);
        }
    }


    // check for hallucinations 

    private validateQuestions(questions: GeneratedQuestion[], expectedCount: number): void {
        if (!Array.isArray(questions)) {
            throw new Error('LLM response is not an array');
        }

        if (questions.length === 0) {
            throw new Error('No questions generated');
        }

        if (questions.length !== expectedCount) {
            this.logger.warn(
                `Expected ${expectedCount} questions but got ${questions.length}`,
            );
        }

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];

            if (!q.questionStem || typeof q.questionStem !== 'string') {
                throw new Error(`Question ${i + 1}: Missing or invalid questionStem`);
            }

            if (!q.explanation || typeof q.explanation !== 'string') {
                throw new Error(`Question ${i + 1}: Missing or invalid explanation`);
            }

            if (!Array.isArray(q.answerChoices) || q.answerChoices.length < 2) {
                throw new Error(`Question ${i + 1}: answerChoices must be an array with at least 2 options`);
            }

            // Validate answer choices are strings
            for (let j = 0; j < q.answerChoices.length; j++) {
                if (typeof q.answerChoices[j] !== 'string') {
                    throw new Error(`Question ${i + 1}, Choice ${j + 1}: Must be a string`);
                }
            }

            if (typeof q.correctAnswerIndex !== 'number' ||
                q.correctAnswerIndex < 0 ||
                q.correctAnswerIndex >= q.answerChoices.length) {
                throw new Error(
                    `Question ${i + 1}: correctAnswerIndex ${q.correctAnswerIndex} is out of range for ${q.answerChoices.length} choices`,
                );
            }

            // Validate topicTags if present
            if (q.topicTags && !Array.isArray(q.topicTags)) {
                throw new Error(`Question ${i + 1}: topicTags must be an array`);
            }
        }

        this.logger.log(`Successfully validated ${questions.length} questions`);
    }

    private formatDifficulty(difficulty: string): string {
        switch (difficulty) {
            case 'EASY':
                return 'Easy';
            case 'MEDIUM':
                return 'Medium';
            case 'HARD':
                return 'Hard';
            default:
                return 'Medium';
        }
    }
}