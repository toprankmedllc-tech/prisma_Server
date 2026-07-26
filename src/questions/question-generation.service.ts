import { Injectable, Logger } from '@nestjs/common';
import { LLMService } from '../llm/llm.service';
import { ChromaService } from '../chroma/chroma.service';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateQuestionsDto, QuestionSourceType } from './dto/request.dto';
import { QuestionResponseDto } from './dto/response.dto';
import {
    RAG_QUESTION_SYSTEM_PROMPT,
    BUZZWORD_QUESTION_USER_PROMPT,
    VIGNETTE_QUESTION_USER_PROMPT,
} from '../llm/prompts/rag-question.prompt';

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
    ) { }

    async generateQuestions(dto: GenerateQuestionsDto) {
        // Step 1: Build a rich query for Chroma DB
        const queryText = this.buildChromaQuery(dto);
        this.logger.log(`Querying Chroma with: "${queryText}"`);

        const retrievedChunks = await this.chromaService.query(queryText, 10);

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
        const llmResponse = await this.llmService.generateWithPrompt(
            RAG_QUESTION_SYSTEM_PROMPT,
            userPrompt,
            { temperature: 0.3, maxTokens: 8192, jsonMode: true },
        );

        // Step 4: Parse the LLM response
        const parsedResponse = this.parseLLMResponse(llmResponse, dto.count);

        // Step 5: Find or create the topic in PostgreSQL
        const topic = await this.findOrCreateTopic(dto.topic);

        // Step 6: Save questions to PostgreSQL
        const savedQuestions = await this.saveRichQuestions(parsedResponse, topic.id, dto.sourceType);

        // Step 7: Format response
        return {
            success: true,
            message: `Successfully generated ${savedQuestions.length} ${dto.sourceType} question(s)`,
            questions: savedQuestions,
            sourceType: dto.sourceType,
            tokenUsage: undefined,
        };
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
        // Remove any markdown code blocks if present
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
            // Try to extract JSON object
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

        // Extract questions from the response
        let questions: GeneratedRichQuestion[];
        if (parsed.questions && Array.isArray(parsed.questions)) {
            questions = parsed.questions;
        } else if (Array.isArray(parsed)) {
            questions = parsed as any;
        } else {
            throw new Error('LLM response does not contain a "questions" array');
        }

        // Validate
        if (questions.length === 0) {
            throw new Error('No questions generated');
        }

        if (questions.length !== expectedCount) {
            this.logger.warn(`Expected ${expectedCount} questions but got ${questions.length}`);
        }

        // Validate each question has required fields
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

            // Validate correctAnswerLetter matches a choice
            const correctChoice = q.choices.find(
                (c) => c.letter === q.correctAnswerLetter,
            );
            if (!correctChoice) {
                throw new Error(
                    `Question ${i + 1}: correctAnswerLetter "${q.correctAnswerLetter}" does not match any choice letter`,
                );
            }

            // Ensure correct choice is marked as isCorrect
            const correctChoices = q.choices.filter((c) => c.isCorrect);
            if (correctChoices.length !== 1) {
                // Auto-correct: set the one matching correctAnswerLetter
                q.choices.forEach((c) => {
                    c.isCorrect = c.letter === q.correctAnswerLetter;
                });
            }

            // Ensure wrongOptions exist for all incorrect choices
            if (!Array.isArray(q.wrongOptions)) {
                q.wrongOptions = [];
            }
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

            // Ensure tags is an array
            if (!Array.isArray(q.tags)) {
                q.tags = [];
            }

            // Ensure keySymptoms is an array
            if (!Array.isArray(q.keySymptoms)) {
                q.keySymptoms = [];
            }

            // Ensure relatedConcepts is an array
            if (!Array.isArray(q.relatedConcepts)) {
                q.relatedConcepts = [];
            }

            // Ensure buzzwords is an array
            if (!Array.isArray(q.buzzwords)) {
                q.buzzwords = [];
            }

            // Normalize cognitiveLevel
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

    // ============================================
    // SAVE RICH QUESTIONS
    // ============================================
    private async saveRichQuestions(
        questions: GeneratedRichQuestion[],
        topicId: string,
        sourceType: QuestionSourceType,
    ): Promise<QuestionResponseDto[]> {
        const savedQuestions: QuestionResponseDto[] = [];

        for (const q of questions) {
            // Process tags - find or create each tag
            const tagRecords = await Promise.all(
                q.tags.map(async (tagName) => {
                    if (!tagName || !tagName.trim()) return null;
                    return this.prisma.tag.upsert({
                        where: { name: tagName.trim() },
                        create: { name: tagName.trim() },
                        update: {},
                    });
                }),
            ).then((results) => results.filter(Boolean));

            // Create the question with ALL rich fields
            const question = await this.prisma.question.create({
                data: {
                    // === BASIC INFORMATION ===
                    stem: q.stem,
                    leadInQuestion: q.leadInQuestion || null,
                    explanation: q.explanation,

                    // === SOURCE & METADATA ===
                    source: 'AI_GENERATED',
                    sourceType: sourceType === QuestionSourceType.BUZZWORD ? 'BUZZWORD' : 'VIGNETTE',

                    // === MEDICAL CLASSIFICATION ===
                    topicId,
                    system: q.system || null,
                    discipline: q.discipline || null,
                    cognitiveLevel: this.mapCognitiveLevel(q.cognitiveLevel),
                    difficulty: this.mapDifficulty(q.difficulty),
                    trapType: q.trapType || null,

                    // === CLINICAL PRESENTATION ===
                    patientProfile: q.patientProfile || null,
                    chiefComplaint: q.chiefComplaint || null,
                    keySymptoms: q.keySymptoms || [],
                    physicalExam: q.physicalExam || null,

                    // === DIAGNOSTIC CLUES ===
                    mainClue: q.mainClue || null,
                    supportingClue: q.supportingClue || null,

                    // === ANSWER ===
                    correctAnswerLetter: q.correctAnswerLetter || null,
                    correctAnswerText: q.correctAnswerText || null,

                    // === DETAILED EXPLANATIONS ===
                    stepByStepReasoning: q.stepByStepReasoning || null,
                    educationalObjective: q.educationalObjective || null,

                    // === BUZZWORD SPECIFIC ===
                    buzzwords: q.buzzwords || [],
                    buzzwordCombinationCorrect: q.buzzwordCombinationCorrect || null,

                    // === TAGS & CONCEPTS ===
                    relatedConcepts: q.relatedConcepts || [],

                    // === PUBLICATION STATUS ===
                    isPublished: false,
                    reviewed: false,

                    // === RELATIONS ===
                    choices: {
                        create: q.choices.map((choice) => ({
                            letter: choice.letter,
                            text: choice.text,
                            isCorrect: choice.isCorrect,
                            order: choice.order,
                        })),
                    },
                    wrongOptions: {
                        create: q.wrongOptions.map((wo) => ({
                            letter: wo.letter,
                            text: wo.text,
                            explanation: wo.explanation || '',
                            buzzwordCombo: wo.buzzwordCombo || null,
                            order: q.choices.findIndex((c) => c.letter === wo.letter),
                        })),
                    },
                    vitals: q.vitals
                        ? {
                            create: {
                                bloodPressure: q.vitals.bloodPressure || null,
                                heartRate: q.vitals.heartRate || null,
                                pulseOximetry: q.vitals.pulseOximetry || null,
                                temperature: q.vitals.temperature || null,
                                respiratoryRate: q.vitals.respiratoryRate || null,
                            },
                        }
                        : undefined,
                    tags: {
                        create: tagRecords.map((tag) => ({
                            tagId: tag!.id,
                        })),
                    },
                },
                include: {
                    choices: { orderBy: { order: 'asc' } },
                    tags: { include: { tag: true } },
                    wrongOptions: { orderBy: { order: 'asc' } },
                    vitals: true,
                    topic: true,
                },
            });

            savedQuestions.push({
                id: question.id,
                stem: question.stem,
                explanation: question.explanation,
                difficulty: question.difficulty,
                source: question.source,
                topicId: question.topicId,
                choices: question.choices.map((c) => ({
                    id: c.id,
                    text: c.text,
                    isCorrect: c.isCorrect,
                    order: c.order,
                })),
                tags: question.tags.map((qt) => qt.tag.name),
                isPublished: question.isPublished,
                createdAt: question.createdAt,
            });

            this.logger.debug(`Saved question: ${q.stem.substring(0, 60)}...`);
        }

        this.logger.log(`Successfully saved ${savedQuestions.length} questions to database`);
        return savedQuestions;
    }

    // ============================================
    // HELPER: Find or create topic
    // ============================================
    private async findOrCreateTopic(topicName: string) {
        let topic = await this.prisma.topic.findFirst({
            where: { name: topicName },
            include: { subject: true },
        });

        if (!topic) {
            let subject = await this.prisma.subject.findFirst({
                where: { name: 'Clinical Medicine' },
            });

            if (!subject) {
                subject = await this.prisma.subject.create({
                    data: {
                        name: 'Clinical Medicine',
                        description: 'Clinical medicine topics for USMLE preparation',
                    },
                });
            }

            topic = await this.prisma.topic.create({
                data: { name: topicName, subjectId: subject.id },
                include: { subject: true },
            });

            this.logger.log(`Created new topic: "${topicName}"`);
        }

        return topic;
    }

    // ============================================
    // HELPERS: Map enums
    // ============================================
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