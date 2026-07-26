import { Injectable, Logger } from '@nestjs/common';
import { LLMService, GeneratedQuestion } from '../llm/llm.service';
import { ChromaService } from '../chroma/chroma.service';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateQuestionsDto } from './dto/request.dto';
import { QuestionResponseDto } from './dto/response.dto';

@Injectable()
export class QuestionGenerationService {
    private readonly logger = new Logger(QuestionGenerationService.name);

    constructor(
        private llmService: LLMService,
        private chromaService: ChromaService,
        private prisma: PrismaService,
    ) { }

    async generateQuestions(dto: GenerateQuestionsDto) {
        // Step 1: Retrieve relevant context from Chroma DB
        this.logger.log(`Retrieving context for topic: "${dto.topic}"`);

        const queryText = `${dto.topic} USMLE ${dto.examType.replace('_', ' ')} ${dto.difficulty} medical concepts key points`;


        //  const queryText = "ify";

        const retrievedChunks = await this.chromaService.query(queryText, 5);

        if (!retrievedChunks.length) {
            throw new Error(
                `No relevant medical content found for topic: "${dto.topic}". Please ingest training data first.`,
            );
        }

        const context = retrievedChunks
            .map((chunk, index) => `[Source ${index + 1}]:\n${chunk.content}`)
            .join('\n\n');

        this.logger.log(
            `Retrieved ${retrievedChunks.length} chunks for context`,
        );

        // Step 2: Generate questions via LLM
        this.logger.log(
            `Generating ${dto.count} questions at ${dto.difficulty} difficulty`,
        );

        const generatedQuestions = await this.llmService.generateUSMLEQuestions({
            topic: dto.topic,
            difficulty: dto.difficulty,
            examType: dto.examType,
            count: dto.count,
            context
        });

        // Step 3: Find or create the topic in PostgreSQL
        const topic = await this.findOrCreateTopic(dto.topic);
        if (!topic) {
            throw new Error(
                `Unable to resolve or create topic: "${dto.topic}"`,
            );
        }

        // Step 4: Save questions to PostgreSQL
        const savedQuestions = await this.saveQuestions(
            generatedQuestions,
            topic.id,
        );

        // Step 5: Format response
        return {
            success: true,
            message: `Successfully generated ${savedQuestions.length} question(s)`,
            questions: savedQuestions,
            tokenUsage: undefined, // Will be populated later if needed
        };
    }


    // async generateQuestions(dto: GenerateQuestionsDto, useDummyContext: boolean = true) {
    //     let context: string;

    //     if (useDummyContext) {
    //         // Step 1: Use dummy context for testing
    //         this.logger.log(`Using dummy context for topic: "${dto.topic}"`);

    //         context = `
    //     Medical education content for ${dto.topic} at ${dto.difficulty} difficulty.
    //     Include typical clinical presentations, diagnostic approaches, and management strategies.
    //     `;
    //     } else {
    //         // Step 1: Retrieve relevant context from Chroma DB
    //         this.logger.log(`Retrieving context for topic: "${dto.topic}"`);

    //         const queryText = `${dto.topic} USMLE ${dto.examType.replace('_', ' ')} ${dto.difficulty} medical concepts key points`;

    //         const retrievedChunks = await this.chromaService.query(queryText, 5);

    //         if (!retrievedChunks.length) {
    //             throw new Error(
    //                 `No relevant medical content found for topic: "${dto.topic}". Please ingest training data first.`,
    //             );
    //         }

    //         context = retrievedChunks
    //             .map((chunk, index) => `[Source ${index + 1}]:\n${chunk.content}`)
    //             .join('\n\n');

    //         this.logger.log(
    //             `Retrieved ${retrievedChunks.length} chunks for context`,
    //         );
    //     }

    //     // Step 2: Generate questions via LLM
    //     this.logger.log(
    //         `Generating ${dto.count} questions at ${dto.difficulty} difficulty`,
    //     );

    //     const generatedQuestions = await this.llmService.generateUSMLEQuestions({
    //         topic: dto.topic,
    //         difficulty: dto.difficulty,
    //         examType: dto.examType,
    //         count: dto.count,
    //         context
    //     });

    //     // Rest of the code remains the same...
    //     const topic = await this.findOrCreateTopic(dto.topic);
    //     if (!topic) {
    //         throw new Error(
    //             `Unable to resolve or create topic: "${dto.topic}"`,
    //         );
    //     }

    //     const savedQuestions = await this.saveQuestions(
    //         generatedQuestions,
    //         topic.id,
    //     );

    //     return {
    //         success: true,
    //         message: `Successfully generated ${savedQuestions.length} question(s)`,
    //         questions: savedQuestions,
    //         tokenUsage: undefined,
    //         dummyContextUsed: useDummyContext,
    //     };
    // }

    private async findOrCreateTopic(topicName: string) {
        // First try to find an exact match
        let topic = await this.prisma.topic.findFirst({
            where: { name: topicName },
            include: { subject: true },
        });

        if (!topic) {
            // Create with a default subject if none exists
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
                data: {
                    name: topicName,
                    subjectId: subject.id,
                },
                include: {
                    subject: true,
                },
            });

            this.logger.log(`Created new topic: "${topicName}"`);
        }

        return topic;
    }

    private async saveQuestions(
        questions: GeneratedQuestion[],
        topicId: string,
    ): Promise<QuestionResponseDto[]> {
        const savedQuestions: QuestionResponseDto[] = [];

        for (const q of questions) {
            // Process tags - find or create each tag
            const tagRecords = await Promise.all(
                q.topicTags.map(async (tagName) => {
                    return this.prisma.tag.upsert({
                        where: { name: tagName },
                        create: { name: tagName },
                        update: {},
                    });
                }),
            );

            // Create the question with choices and tags
            const question = await this.prisma.question.create({
                data: {
                    stem: q.questionStem,
                    explanation: q.explanation,
                    difficulty: this.mapDifficulty(q.difficulty),
                    source: 'AI_GENERATED',
                    topicId,
                    isPublished: false,
                    choices: {
                        create: q.answerChoices.map((text, index) => ({
                            text,
                            isCorrect: index === q.correctAnswerIndex,
                            order: index,
                        })),
                    },
                    tags: {
                        create: tagRecords.map((tag) => ({
                            tagId: tag.id,
                        })),
                    },
                },
                include: {
                    choices: {
                        orderBy: { order: 'asc' },
                    },
                    tags: {
                        include: {
                            tag: true,
                        },
                    },
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
        }

        return savedQuestions;
    }

    private mapDifficulty(difficulty: string) {
        switch (difficulty) {
            case 'EASY':
                return 'EASY' as const;
            case 'MEDIUM':
                return 'MEDIUM' as const;
            case 'HARD':
                return 'HARD' as const;
            default:
                return 'MEDIUM' as const;
        }
    }
}