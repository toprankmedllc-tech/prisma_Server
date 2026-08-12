import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { LLMService } from '../llm/llm.service';
import { ChromaService } from '../chroma/chroma.service';
import type { QueryResult } from '../chroma/chroma.service';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateQuestionsDto, QuestionSourceType } from './dto/request.dto';
import { QuestionResponseDto } from './dto/response.dto';
import {
    RAG_QUESTION_SYSTEM_PROMPT,
    BUZZWORD_QUESTION_USER_PROMPT,
    VIGNETTE_QUESTION_USER_PROMPT,
} from '../llm/prompts/rag-question.prompt';
import { AiReviewService } from '../ai-review/ai-review.service';
// import { AiReviewService } from '../ai-review/ai-review.service';s

// ============================================
// INTERFACES
// ============================================

interface GeneratedChoice {
    letter: string;
    text: string;
    isCorrect: boolean;
    order: number;
}

interface GeneratedWrongOption {
    letter: string;
    text: string;
    explanation: string;
    buzzwordCombo: string | null;
}

interface GeneratedVitals {
    bloodPressure?: string | null;
    heartRate?: number | null;
    pulseOximetry?: number | null;
    temperature?: number | null;
    respiratoryRate?: number | null;
}

interface GeneratedRichQuestion {
    stem: string;
    leadInQuestion: string | null;
    explanation: string;
    system: string | null;
    discipline: string | null;
    cognitiveLevel: string | null;
    difficulty: string;
    trapType: string | null;
    patientProfile: string | null;
    chiefComplaint: string | null;
    keySymptoms: string[];
    physicalExam: string | null;
    vitals: GeneratedVitals | null;
    mainClue: string | null;
    supportingClue: string | null;
    correctAnswerLetter: string;
    correctAnswerText: string;
    choices: GeneratedChoice[];
    wrongOptions: GeneratedWrongOption[];
    buzzwords: string[];
    buzzwordCombinationCorrect: string | null;
    stepByStepReasoning: string | null;
    educationalObjective: string | null;
    tags: string[];
    relatedConcepts: string[];
}

interface LLMResponse {
    questions: GeneratedRichQuestion[];
}

@Injectable()
export class QuestionGenerationService {
    private readonly logger = new Logger(QuestionGenerationService.name);

    constructor(
        private llmService: LLMService,
        private chromaService: ChromaService,
        private prisma: PrismaService,
        @Inject(forwardRef(() => AiReviewService))
        private aiReviewService: AiReviewService,
    ) { }

    async generateQuestions(dto: GenerateQuestionsDto) {
        try {
            // Step 1: Build a rich query for Chroma DB
            const queryText = this.buildChromaQuery(dto);
            this.logger.log(`Querying Chroma with: "${queryText}"`);

            let retrievedChunks: QueryResult[];
            try {
                retrievedChunks = await this.chromaService.query(queryText, 10);
            } catch (chromaError: any) {
                this.logger.error(`ChromaDB query failed: ${chromaError.message}`);
                throw new Error(
                    `Failed to query ChromaDB: ${chromaError.message}. Please check the ChromaDB connection.`,
                );
            }

            if (!retrievedChunks.length) {
                throw new Error(
                    `No relevant medical content found for topic: "${dto.topic}". Please ingest training data first.`,
                );
            }

            const context = retrievedChunks
                .map((chunk, index) => `[Source ${index + 1}]:\n${chunk.content}`)
                .join('\n\n');

            this.logger.log(`Retrieved ${retrievedChunks.length} chunks for context`);

            // Step 2: Build the prompt based on question type
            const userPrompt = this.buildUserPrompt(dto, context);
            this.logger.log(`Generating ${dto.count} ${dto.sourceType} question(s) at ${dto.difficulty} difficulty`);

            // Step 3: Call LLM with the RAG prompt
            let llmResponse: string;
            try {
                llmResponse = await this.llmService.generateWithPrompt(
                    RAG_QUESTION_SYSTEM_PROMPT,
                    userPrompt,
                    { temperature: 0.3, maxTokens: 8192, jsonMode: true },
                );
            } catch (llmError: any) {
                this.logger.error(`LLM generation failed: ${llmError.message}`);
                throw new Error(
                    `AI generation failed: ${llmError.message}. The LLM service may be unavailable or rate-limited.`,
                );
            }

            // Step 4: Parse the LLM response
            let parsedResponse: GeneratedRichQuestion[];
            try {
                parsedResponse = this.parseLLMResponse(llmResponse, dto.count);
            } catch (parseError: any) {
                this.logger.error(`Failed to parse LLM response: ${parseError.message}`);
                this.logger.debug(`Raw LLM response (first 500 chars): ${llmResponse.substring(0, 500)}`);
                throw new Error(
                    `Failed to parse AI response: ${parseError.message}. The generated content may not be in the expected format.`,
                );
            }

            // Step 5: Find or create the topic in PostgreSQL
            let topic: any;
            try {
                topic = await this.findOrCreateTopic(dto.topic);
            } catch (dbError: any) {
                this.logger.error(`Database error finding/creating topic: ${dbError.message}`);
                throw new Error(`Database error: ${dbError.message}`);
            }

            // Step 6: Save questions to PostgreSQL
            let savedQuestions: QuestionResponseDto[];
            try {
                savedQuestions = await this.saveRichQuestions(parsedResponse, topic.id, dto.sourceType);
            } catch (saveError: any) {
                this.logger.error(`Failed to save questions to database: ${saveError.message}`);
                throw new Error(`Failed to save generated questions: ${saveError.message}`);
            }

            // Step 7: Queue AI review for each generated question (fire-and-forget)
            this.queueAiReviewsForQuestions(savedQuestions);

            // Step 8: Format response
            return {
                success: true,
                message: `Successfully generated ${savedQuestions.length} ${dto.sourceType} question(s)`,
                questions: savedQuestions,
                sourceType: dto.sourceType,
                tokenUsage: undefined,
            };
        } catch (error: any) {
            this.logger.error(`Question generation failed: ${error.message}`);
            throw error; // Re-throw for the global exception filter to handle
        }
    }

    // ============================================
    // QUEUE AI REVIEWS FOR GENERATED QUESTIONS
    // ============================================
    private async queueAiReviewsForQuestions(questions: QuestionResponseDto[]): Promise<void> {
        if (!questions || questions.length === 0) return;

        this.logger.log(`Queueing AI review for ${questions.length} newly generated question(s)`);

        for (const question of questions) {
            try {
                await this.aiReviewService.queueAiReviewForQuestion(question.id, {
                    autoPublish: true,
                    autoRegenerate: true,
                });
            } catch (error: any) {
                // Non-blocking: if queueing fails, don't fail the generation
                this.logger.warn(`Failed to queue AI review for question ${question.id}: ${error.message}`);
            }
        }
    }

    // ============================================
    // BUILD CHROMA QUERY
    // ============================================
    private buildChromaQuery(dto: GenerateQuestionsDto): string {
        const parts: string[] = [
            dto.topic,
            'USMLE',
            dto.examType.replace('_', ' '),
            'medical concepts',
            'key points',
        ];

        if (dto.discipline) {
            parts.push(dto.discipline);
        }

        if (dto.subject) {
            parts.push(dto.subject);
        }

        parts.push(dto.difficulty);

        // Add source-type-specific keywords
        if (dto.sourceType === QuestionSourceType.BUZZWORD) {
            parts.push('buzzwords', 'keywords', 'associations');
        } else {
            parts.push('clinical presentation', 'diagnosis', 'management');
        }

        return parts.join(' ');
    }

    // ============================================
    // BUILD USER PROMPT
    // ============================================
    private buildUserPrompt(dto: GenerateQuestionsDto, context: string): string {
        const topicExtras: string[] = [];
        if (dto.subject) topicExtras.push(`SUBJECT: ${dto.subject}`);
        if (dto.discipline) topicExtras.push(`DISCIPLINE: ${dto.discipline}`);

        const topicExtrasStr = topicExtras.length > 0 ? topicExtras.join('\n') : '';

        if (dto.sourceType === QuestionSourceType.BUZZWORD) {
            return BUZZWORD_QUESTION_USER_PROMPT
                .replace(/{count}/g, dto.count.toString())
                .replace(/{topic}/g, dto.topic)
                .replace(/{topicExtras}/g, topicExtrasStr)
                .replace(/{difficulty}/g, dto.difficulty)
                .replace(/{examType}/g, dto.examType.replace('_', ' '))
                .replace(/{context}/g, context);
        } else {
            const clinicalRep = dto.clinicalRepresentation ? 'YES — Include full patient profile, vitals, physical exam, labs, and imaging details' : 'STANDARD — Include appropriate clinical details but keep it focused';
            return VIGNETTE_QUESTION_USER_PROMPT
                .replace(/{count}/g, dto.count.toString())
                .replace(/{topic}/g, dto.topic)
                .replace(/{topicExtras}/g, topicExtrasStr)
                .replace(/{difficulty}/g, dto.difficulty)
                .replace(/{examType}/g, dto.examType.replace('_', ' '))
                .replace(/{clinicalRep}/g, clinicalRep)
                .replace(/{context}/g, context);
        }
    }

    // ============================================
    // PARSE LLM RESPONSE
    // ============================================
    private parseLLMResponse(content: string, expectedCount: number): GeneratedRichQuestion[] {
        let cleanedContent = content.trim();

        if (cleanedContent.startsWith('```json')) {
            cleanedContent = cleanedContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (cleanedContent.startsWith('```')) {
            cleanedContent = cleanedContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        let parsed: LLMResponse;

        try {
            parsed = JSON.parse(cleanedContent);
        } catch (error: any) {
            const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    parsed = JSON.parse(jsonMatch[0]);
                } catch (e: any) {
                    this.logger.error('Raw response that failed to parse:', cleanedContent.substring(0, 500));
                    throw new Error(`Failed to parse LLM response as JSON: ${e.message}`);
                }
            } else {
                this.logger.error('Raw response that failed to parse:', cleanedContent.substring(0, 500));
                throw new Error(`Invalid JSON response from LLM: ${error.message}`);
            }
        }

        let questions: GeneratedRichQuestion[];
        if (parsed.questions && Array.isArray(parsed.questions)) {
            questions = parsed.questions;
        } else if (Array.isArray(parsed)) {
            questions = parsed as any;
        } else {
            throw new Error('LLM response does not contain a "questions" array');
        }

        if (questions.length === 0) {
            throw new Error('No questions generated');
        }

        if (questions.length !== expectedCount) {
            this.logger.warn(`Expected ${expectedCount} questions but got ${questions.length}`);
        }

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.stem || typeof q.stem !== 'string') {
                throw new Error(`Question ${i + 1}: Missing or invalid "stem"`);
            }
            if (!q.explanation || typeof q.explanation !== 'string') {
                throw new Error(`Question ${i + 1}: Missing or invalid "explanation"`);
            }
            if (!Array.isArray(q.choices) || q.choices.length < 2) {
                throw new Error(`Question ${i + 1}: "choices" must be an array with at least 2 options`);
            }
            if (!q.correctAnswerLetter || typeof q.correctAnswerLetter !== 'string') {
                throw new Error(`Question ${i + 1}: Missing or invalid "correctAnswerLetter"`);
            }

            const correctChoice = q.choices.find((c) => c.letter === q.correctAnswerLetter);
            if (!correctChoice) {
                throw new Error(`Question ${i + 1}: correctAnswerLetter "${q.correctAnswerLetter}" does not match any choice letter`);
            }

            const correctChoices = q.choices.filter((c) => c.isCorrect);
            if (correctChoices.length !== 1) {
                q.choices.forEach((c) => { c.isCorrect = c.letter === q.correctAnswerLetter; });
            }

            if (!Array.isArray(q.wrongOptions)) { q.wrongOptions = []; }
            const incorrectChoices = q.choices.filter((c) => !c.isCorrect);
            for (const ic of incorrectChoices) {
                const existing = q.wrongOptions.find((wo) => wo.letter === ic.letter);
                if (!existing) {
                    q.wrongOptions.push({
                        letter: ic.letter,
                        text: `${ic.letter}. ${ic.text}`,
                        explanation: `This option is incorrect.`,
                        buzzwordCombo: null,
                    });
                }
            }

            if (!Array.isArray(q.tags)) { q.tags = []; }
            if (!Array.isArray(q.keySymptoms)) { q.keySymptoms = []; }
            if (!Array.isArray(q.relatedConcepts)) { q.relatedConcepts = []; }
            if (!Array.isArray(q.buzzwords)) { q.buzzwords = []; }

            if (q.cognitiveLevel) {
                const normalized = q.cognitiveLevel.toUpperCase().trim();
                if (['RECALL', 'APPLICATION', 'CLINICAL_REASONING', 'ANALYSIS'].includes(normalized)) {
                    q.cognitiveLevel = normalized;
                } else {
                    q.cognitiveLevel = null;
                }
            }
        }

        this.logger.log(`Successfully parsed and validated ${questions.length} questions`);
        return questions;
    }

    private async saveRichQuestions(
        questions: GeneratedRichQuestion[],
        topicId: string,
        sourceType: QuestionSourceType,
    ): Promise<QuestionResponseDto[]> {
        const allTagNames = [...new Set(questions.flatMap(q => q.tags.filter(Boolean).map(t => t.trim())))].filter(Boolean);
        const tagNameToId = new Map<string, string>();

        if (allTagNames.length > 0) {
            await this.prisma.$transaction(
                allTagNames.map((tagName) =>
                    this.prisma.tag.upsert({
                        where: { name: tagName },
                        create: { name: tagName },
                        update: {},
                    }),
                ),
            );
            const allTags = await this.prisma.tag.findMany({ where: { name: { in: allTagNames } } });
            for (const tag of allTags) { tagNameToId.set(tag.name, tag.id); }
        }

        const createdQuestions = await this.prisma.$transaction(
            questions.map((q) => {
                const tagIds = q.tags.filter(Boolean).map(t => t.trim()).filter(t => tagNameToId.has(t)).map(t => tagNameToId.get(t)!).filter(Boolean);
                return this.prisma.question.create({
                    data: {
                        stem: q.stem, leadInQuestion: q.leadInQuestion || null, explanation: q.explanation,
                        source: 'AI_GENERATED', sourceType: sourceType === QuestionSourceType.BUZZWORD ? 'BUZZWORD' : 'VIGNETTE',
                        topicId, system: q.system || null, discipline: q.discipline || null,
                        cognitiveLevel: this.mapCognitiveLevel(q.cognitiveLevel), difficulty: this.mapDifficulty(q.difficulty),
                        trapType: q.trapType || null, patientProfile: q.patientProfile || null,
                        chiefComplaint: q.chiefComplaint || null, keySymptoms: q.keySymptoms || [],
                        physicalExam: q.physicalExam || null, mainClue: q.mainClue || null,
                        supportingClue: q.supportingClue || null, correctAnswerLetter: q.correctAnswerLetter || null,
                        correctAnswerText: q.correctAnswerText || null, stepByStepReasoning: q.stepByStepReasoning || null,
                        educationalObjective: q.educationalObjective || null, buzzwords: q.buzzwords || [],
                        buzzwordCombinationCorrect: q.buzzwordCombinationCorrect || null, relatedConcepts: q.relatedConcepts || [],
                        isPublished: false, reviewed: false,
                        choices: { create: q.choices.map((choice) => ({ letter: choice.letter, text: choice.text, isCorrect: choice.isCorrect, order: choice.order })) },
                        wrongOptions: { create: q.wrongOptions.map((wo) => ({ letter: wo.letter, text: wo.text, explanation: wo.explanation || '', buzzwordCombo: wo.buzzwordCombo || null, order: q.choices.findIndex((c) => c.letter === wo.letter) >= 0 ? q.choices.findIndex((c) => c.letter === wo.letter) : 0 })) },
                        vitals: q.vitals ? { create: { bloodPressure: q.vitals.bloodPressure || null, heartRate: q.vitals.heartRate || null, pulseOximetry: q.vitals.pulseOximetry || null, temperature: q.vitals.temperature || null, respiratoryRate: q.vitals.respiratoryRate || null } } : undefined,
                        tags: { create: tagIds.map((tagId) => ({ tagId })) },
                    },
                    include: { choices: { orderBy: { order: 'asc' } }, tags: { include: { tag: true } }, wrongOptions: { orderBy: { order: 'asc' } }, vitals: true, topic: true },
                });
            }),
        );

        return createdQuestions.map((question) => ({
            id: question.id, stem: question.stem, explanation: question.explanation,
            difficulty: question.difficulty, source: question.source, topicId: question.topicId,
            choices: question.choices.map((c) => ({ id: c.id, text: c.text, isCorrect: c.isCorrect, order: c.order })),
            tags: question.tags.map((qt) => qt.tag.name), isPublished: question.isPublished, createdAt: question.createdAt,
        }));
    }

    private async findOrCreateTopic(topicName: string) {
        let topic = await this.prisma.topic.findFirst({ where: { name: topicName }, include: { subject: true } });
        if (!topic) {
            let subject = await this.prisma.subject.findFirst({ where: { name: 'Clinical Medicine' } });
            if (!subject) {
                subject = await this.prisma.subject.create({ data: { name: 'Clinical Medicine', description: 'Clinical medicine topics for USMLE preparation' } });
            }
            topic = await this.prisma.topic.create({ data: { name: topicName, subjectId: subject.id }, include: { subject: true } });
            this.logger.log(`Created new topic: "${topicName}"`);
        }
        return topic;
    }

    private mapDifficulty(difficulty: string) {
        const d = difficulty.toUpperCase().trim();
        if (d === 'EASY' || d === '1') return 'EASY' as const;
        if (d === 'HARD' || d === '3' || d === '5') return 'HARD' as const;
        return 'MEDIUM' as const;
    }

    private mapCognitiveLevel(level: string | null) {
        if (!level) return null;
        const normalized = level.toUpperCase().trim();
        if (normalized === 'RECALL') return 'RECALL' as const;
        if (normalized === 'APPLICATION' || normalized === 'APPLY') return 'APPLICATION' as const;
        if (normalized === 'CLINICAL_REASONING' || normalized === 'REASONING') return 'CLINICAL_REASONING' as const;
        if (normalized === 'ANALYSIS' || normalized === 'ANALYZE') return 'ANALYSIS' as const;
        return null;
    }
}
