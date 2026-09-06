import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionResponseDto, ReviewDashboardItemDto, QuestionDetailDto } from './dto/response.dto';
import { CognitiveLevel, Difficulty, QuestionSource, QuestionSourceType, Tag, Topic, Prisma } from '@prisma/client';

@Injectable()
export class QuestionsService {
    private readonly logger = new Logger(QuestionsService.name);
    constructor(private prisma: PrismaService) { }


    // ============================================
    // NEW: Import questions from JSON
    // ============================================
    async importQuestions(
        questions: any[],
        sourceType: 'BUZZWORD' | 'VIGNETTE',
        sourceFile: string,
    ): Promise<{ imported: number; failed: number; errors: string[] }> {
        let imported = 0;
        let failed = 0;
        const errors: string[] = [];

        this.logger.log(`Importing ${questions.length} questions from ${sourceFile}`);

        for (const [index, questionData] of questions.entries()) {
            try {
                // Find or create topic (using discipline as subject name)
                const topic = await this.findOrCreateTopic(
                    questionData.topicName,
                    questionData.discipline,
                );

                // Find or create tags
                const tagRecords = await this.processTags(questionData.tags || []);

                // Process choices
                const choices = (questionData.choices || []).map((choice: any, idx: number) => ({
                    letter: choice.letter || String.fromCharCode(65 + idx),
                    text: choice.text,
                    isCorrect: choice.isCorrect || false,
                    order: choice.order !== undefined ? choice.order : idx,
                }));

                // Process wrong options
                const wrongOptions = (questionData.wrongOptions || []).map((wo: any, idx: number) => ({
                    letter: wo.letter || String.fromCharCode(65 + idx),
                    text: wo.text,
                    explanation: wo.explanation || '',
                    buzzwordCombo: wo.buzzwordCombo || null,
                    order: wo.order !== undefined ? wo.order : idx,
                }));

                // Process vitals
                const vitalsData = questionData.vitals ? {
                    bloodPressure: questionData.vitals.bloodPressure || null,
                    heartRate: questionData.vitals.heartRate || null,
                    pulseOximetry: questionData.vitals.pulseOximetry || null,
                    temperature: questionData.vitals.temperature || null,
                    respiratoryRate: questionData.vitals.respiratoryRate || null,
                } : undefined;

                // Process quality reviews
                const qualityReviewData = questionData.qualityReviews ? {
                    medicalAccuracy: questionData.qualityReviews.medicalAccuracy || null,
                    usmleStyle: questionData.qualityReviews.usmleStyle || null,
                    explanationQuality: questionData.qualityReviews.explanationQuality || null,
                    originality: questionData.qualityReviews.originality || null,
                    grammar: questionData.qualityReviews.grammar || null,
                    vignetteReview: questionData.qualityReviews.vignetteReview || null,
                    buzzwordReview: questionData.qualityReviews.buzzwordReview || null,
                } : undefined;

                // Create the question
                const question = await this.prisma.question.create({
                    data: {
                        // Basic Information
                        stem: questionData.stem || '',
                        leadInQuestion: questionData.leadInQuestion || null,
                        explanation: questionData.explanation || '',
                        qid: questionData.qid || null,

                        // Source & Metadata
                        source: 'HUMAN_GENERATED',
                        sourceType: sourceType,
                        sourceRow: questionData.sourceRow || null,
                        sourceFile: sourceFile,
                        importedAt: new Date(),
                        importedBy: 'json_import_script',

                        // Medical Classification
                        topicId: topic.id,
                        system: questionData.system || null,
                        discipline: questionData.discipline || null,
                        cognitiveLevel: this.mapCognitiveLevel(questionData.cognitiveLevel),
                        difficulty: this.mapDifficulty(questionData.difficulty),
                        trapType: questionData.trapType || null,

                        // Clinical Presentation
                        patientProfile: questionData.patientProfile || null,
                        chiefComplaint: questionData.chiefComplaint || null,
                        keySymptoms: questionData.keySymptoms || [],
                        physicalExam: questionData.physicalExam || null,

                        // Diagnostic Clues
                        mainClue: questionData.mainClue || null,
                        supportingClue: questionData.supportingClue || null,

                        // Answer
                        correctAnswerLetter: questionData.correctAnswerLetter || null,
                        correctAnswerText: questionData.correctAnswerText || null,

                        // Detailed Explanations
                        stepByStepReasoning: questionData.stepByStepReasoning || null,
                        educationalObjective: questionData.educationalObjective || null,

                        // Buzzword Specific
                        buzzwords: questionData.buzzwords || [],
                        buzzwordCombinationCorrect: questionData.buzzwordCombinationCorrect || null,

                        // Tags & Concepts
                        relatedConcepts: questionData.relatedConcepts || [],

                        // Images
                        suggestedImages: questionData.suggestedImages || null,

                        // Is Published
                        isPublished: false,  // Imported questions start as unpublished and need basic review first

                        // Relations
                        choices: {
                            create: choices,
                        },
                        wrongOptions: {
                            create: wrongOptions,
                        },
                        vitals: vitalsData ? {
                            create: vitalsData,
                        } : undefined,
                        qualityReview: qualityReviewData ? {
                            create: qualityReviewData,
                        } : undefined,
                        tags: {
                            create: tagRecords.map((tag: any) => ({
                                tagId: tag.id,
                            })),
                        },
                    },
                });

                imported++;
                this.logger.debug(`Imported question ${index + 1}: ${questionData.topicName || 'Unknown Topic'}`);

            } catch (error: any) {
                failed++;
                errors.push(`Row ${index + 1}: ${error.message}`);
                this.logger.error(`Failed to import question ${index + 1}: ${error.message}`);
            }
        }

        this.logger.log(`Import complete: ${imported} imported, ${failed} failed`);
        return { imported, failed, errors };
    }

    // ============================================
    // ENHANCED: Find all questions with filters
    // ============================================
    async findAllEnhanced(filters: {
        topic?: string;
        topicId?: string;
        difficulty?: string;
        source?: string;
        sourceType?: string;
        system?: string;
        discipline?: string;
        cognitiveLevel?: string;
        trapType?: string;
        tag?: string;
        search?: string;
        isPublished?: boolean;
        skip?: number;
        take?: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }): Promise<{ data: any[]; total: number; page: number; limit: number }> {
        const {
            topic,
            topicId,
            difficulty,
            source,
            sourceType,
            system,
            discipline,
            cognitiveLevel,
            trapType,
            tag,
            search,
            isPublished,
            skip = 0,
            take = 50,
            sortBy = 'createdAt',
            sortOrder = 'desc',
        } = filters;

        // Build where clause
        const where: any = {};

        if (topic) {
            where.topic = {
                name: {
                    contains: topic,
                    mode: 'insensitive',
                },
            };
        }

        if (topicId) {
            where.topicId = topicId;
        }

        if (difficulty) {
            where.difficulty = difficulty.toUpperCase() as Difficulty;
        }

        if (source) {
            where.source = source.toUpperCase() as QuestionSource;
        }

        if (sourceType) {
            where.sourceType = sourceType.toUpperCase() as QuestionSourceType;
        }

        if (system) {
            where.system = {
                contains: system,
                mode: 'insensitive',
            };
        }

        if (discipline) {
            where.discipline = {
                contains: discipline,
                mode: 'insensitive',
            };
        }

        if (cognitiveLevel) {
            where.cognitiveLevel = cognitiveLevel.toUpperCase() as CognitiveLevel;
        }

        if (trapType) {
            where.trapType = {
                contains: trapType,
                mode: 'insensitive',
            };
        }

        if (tag) {
            where.tags = {
                some: {
                    tag: {
                        name: {
                            contains: tag,
                            mode: 'insensitive',
                        },
                    },
                },
            };
        }

        if (search) {
            where.OR = [
                { stem: { contains: search, mode: 'insensitive' } },
                { explanation: { contains: search, mode: 'insensitive' } },
                { topic: { name: { contains: search, mode: 'insensitive' } } },
            ];
        }

        if (isPublished !== undefined) {
            where.isPublished = isPublished;
        }

        // Build sort order
        const orderBy: any = {};
        if (sortBy === 'topic') {
            orderBy.topic = { name: sortOrder };
        } else {
            orderBy[sortBy] = sortOrder;
        }

        // Get total count
        const total = await this.prisma.question.count({ where });

        // Get paginated data
        const data = await this.prisma.question.findMany({
            where,
            orderBy,
            skip,
            take,
            include: {
                topic: {
                    include: {
                        subject: true,
                    },
                },
                choices: {
                    orderBy: { order: 'asc' },
                },
                wrongOptions: {
                    orderBy: { order: 'asc' },
                },
                vitals: true,
                qualityReview: true,
                tags: {
                    include: {
                        tag: true,
                    },
                },
            },
        });

        const page = Math.floor(skip / take) + 1;
        const limit = take;

        return {
            data,
            total,
            page,
            limit,
        };
    }

    // ============================================
    // NEW: Get all subjects with their topics (and optional question counts)
    // ============================================
    async getSubjectsWithTopics(includeTopics: boolean = true): Promise<any[]> {
        const subjects = await this.prisma.subject.findMany({
            include: includeTopics ? {
                topics: {
                    orderBy: { name: 'asc' },
                },
            } : undefined,
            orderBy: { name: 'asc' },
        });

        if (!includeTopics) {
            return subjects;
        }

        // Get all topic counts in a single grouped query instead of N individual queries
        const topicCounts = await this.prisma.question.groupBy({
            by: ['topicId'],
            _count: true,
        });

        // Build a map of topicId -> count for O(1) lookups
        const countMap = new Map<string, number>();
        topicCounts.forEach((group) => {
            countMap.set(group.topicId, group._count);
        });

        // Attach counts to topics
        return subjects.map((subject: any) => ({
            ...subject,
            topics: subject.topics.map((topic: any) => ({
                ...topic,
                questionCount: countMap.get(topic.id) || 0,
            })),
        }));
    }

    // ============================================
    // NEW: Get all topics (optionally filtered by subject)
    // ============================================
    async getTopics(subjectId?: string): Promise<{ topics: { topicId: string; topic: string; questionCount: number }[]; totalTopics: number; totalQuestionsCount: number }> {
        const where: any = {};
        if (subjectId) {
            where.subjectId = subjectId;
        }

        // Get all topics with their question counts in a single grouped query
        const topics = await this.prisma.topic.findMany({
            where,
            orderBy: { name: 'asc' },
        });

        if (topics.length === 0) {
            return { topics: [], totalTopics: 0, totalQuestionsCount: 0 };
        }

        const topicIds = topics.map(t => t.id);

        const topicCounts = await this.prisma.question.groupBy({
            by: ['topicId'],
            where: {
                topicId: { in: topicIds },
            },
            _count: true,
        });

        const countMap = new Map<string, number>();
        topicCounts.forEach((group) => {
            countMap.set(group.topicId, group._count);
        });

        const mappedTopics = topics.map((topic) => ({
            topicId: topic.id,
            topic: topic.name,
            questionCount: countMap.get(topic.id) || 0,
        }));

        const totalQuestionsCount = mappedTopics.reduce((sum, t) => sum + t.questionCount, 0);

        return {
            topics: mappedTopics,
            totalTopics: mappedTopics.length,
            totalQuestionsCount,
        };
    }

    // ============================================
    // NEW: Bulk delete questions
    // ============================================
    async bulkDeleteQuestions(ids: string[]): Promise<void> {
        const existing = await this.prisma.question.findMany({
            where: { id: { in: ids } },
            select: { id: true },
        });

        const existingIds = existing.map(q => q.id);
        const notFound = ids.filter(id => !existingIds.includes(id));

        if (notFound.length > 0) {
            this.logger.warn(`Questions not found: ${notFound.join(', ')}`);
        }

        if (existingIds.length === 0) {
            throw new NotFoundException('No matching questions found to delete');
        }

        // Delete in transaction to maintain referential integrity
        await this.prisma.$transaction(async (tx) => {
            // Delete wrong options
            await tx.wrongOption.deleteMany({
                where: { questionId: { in: existingIds } },
            });

            // Delete vitals
            await tx.vitals.deleteMany({
                where: { questionId: { in: existingIds } },
            });

            // Delete quality reviews
            await tx.qualityReview.deleteMany({
                where: { questionId: { in: existingIds } },
            });

            // Delete question tags
            await tx.questionTag.deleteMany({
                where: { questionId: { in: existingIds } },
            });

            // Delete choices
            await tx.choice.deleteMany({
                where: { questionId: { in: existingIds } },
            });

            // Delete questions
            await tx.question.deleteMany({
                where: { id: { in: existingIds } },
            });
        });

        this.logger.log(`Bulk deleted ${existingIds.length} questions`);
    }

    // ============================================
    // NEW: Get question statistics
    // ============================================
    async getQuestionStats() {
        const total = await this.prisma.question.count();

        const byDifficulty = await this.prisma.$transaction([
            this.prisma.question.count({ where: { difficulty: 'EASY' } }),
            this.prisma.question.count({ where: { difficulty: 'MEDIUM' } }),
            this.prisma.question.count({ where: { difficulty: 'HARD' } }),
        ]);

        const bySourceType = await this.prisma.$transaction([
            this.prisma.question.count({ where: { sourceType: 'BUZZWORD' } }),
            this.prisma.question.count({ where: { sourceType: 'VIGNETTE' } }),
        ]);

        const bySource = await this.prisma.$transaction([
            this.prisma.question.count({ where: { source: 'HUMAN_GENERATED' } }),
            this.prisma.question.count({ where: { source: 'AI_GENERATED' } }),
            this.prisma.question.count({ where: { source: 'MANUAL' } }),
            this.prisma.question.count({ where: { source: 'IMPORTED' } }),
        ]);

        const published = await this.prisma.question.count({ where: { isPublished: true } });
        const unpublished = await this.prisma.question.count({ where: { isPublished: false } });

        // Get systems with counts
        const systemGroups = await this.prisma.question.groupBy({
            by: ['system'],
            where: { system: { not: null } },
            _count: true,
        });

        const bySystem: Record<string, number> = {};
        systemGroups.forEach(group => {
            if (group.system) {
                bySystem[group.system] = group._count;
            }
        });

        // Get questions grouped by topic and subject
        const topicCounts = await this.prisma.question.groupBy({
            by: ['topicId'],
            _count: true,
        });

        const allTopics = await this.prisma.topic.findMany({
            include: { subject: true },
        });

        const topicCountMap = new Map<string, number>();
        topicCounts.forEach(g => topicCountMap.set(g.topicId, g._count));

        const bySubject: Record<string, number> = {};
        const byTopic: Record<string, number> = {};

        for (const topic of allTopics) {
            const count = topicCountMap.get(topic.id) || 0;
            const subjectName = topic.subject.name;
            bySubject[subjectName] = (bySubject[subjectName] || 0) + count;
            byTopic[topic.name] = count;
        }

        return {
            total,
            byDifficulty: {
                EASY: byDifficulty[0],
                MEDIUM: byDifficulty[1],
                HARD: byDifficulty[2],
            },
            bySourceType: {
                BUZZWORD: bySourceType[0],
                VIGNETTE: bySourceType[1],
            },
            bySource: {
                HUMAN_GENERATED: bySource[0],
                AI_GENERATED: bySource[1],
                MANUAL: bySource[2],
                IMPORTED: bySource[3],
            },
            bySystem,
            bySubject,
            byTopic,
            published,
            unpublished,
        };
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    private async findOrCreateTopic(topicName: string, discipline?: string): Promise<Topic> {
        // Determine subject name from discipline, default to 'Unknown'
        const subjectName = discipline && discipline.trim() ? discipline.trim() : 'Unknown';

        // Find or create the subject
        let subject = await this.prisma.subject.findFirst({
            where: { name: { equals: subjectName, mode: 'insensitive' } },
        });

        if (!subject) {
            subject = await this.prisma.subject.create({
                data: {
                    name: subjectName,
                    description: `${subjectName} topics for USMLE preparation`,
                },
            });
            this.logger.log(`Created subject: ${subjectName}`);
        }

        if (!topicName || topicName === 'Unknown Topic') {
            // Find or create default topic under this subject
            let topic = await this.prisma.topic.findFirst({
                where: {
                    name: 'General Medicine',
                    subjectId: subject.id,
                },
            });

            if (!topic) {
                topic = await this.prisma.topic.create({
                    data: {
                        name: 'General Medicine',
                        subjectId: subject.id,
                    },
                });
                this.logger.log(`Created default topic 'General Medicine' under subject '${subjectName}'`);
            }

            return topic;
        }

        // Find existing topic within this subject
        let topic = await this.prisma.topic.findFirst({
            where: {
                name: { equals: topicName, mode: 'insensitive' },
                subjectId: subject.id,
            },
        });

        if (!topic) {
            // Create new topic under this subject
            topic = await this.prisma.topic.create({
                data: {
                    name: topicName,
                    subjectId: subject.id,
                },
            });
            this.logger.log(`Created topic '${topicName}' under subject '${subjectName}'`);
        }

        return topic;
    }

    private async processTags(tagNames: string[]) {
        const tagRecords: Tag[] = [];  // ← Add type annotation

        for (const name of tagNames) {
            if (name && name.trim()) {
                const tag = await this.prisma.tag.upsert({
                    where: { name: name.trim() },
                    create: { name: name.trim() },
                    update: {},
                });
                tagRecords.push(tag);
            }
        }

        return tagRecords;
    }

    private mapDifficulty(difficulty: string): Difficulty {
        if (!difficulty) return 'MEDIUM';
        const diff = difficulty.toUpperCase().trim();
        if (diff === 'EASY' || diff === '1') return 'EASY';
        if (diff === 'HARD' || diff === '3' || diff === '5') return 'HARD';
        return 'MEDIUM';
    }

    private mapCognitiveLevel(level: string): CognitiveLevel | null {
        if (!level) return null;
        const normalized = level.toUpperCase().trim();
        if (normalized === 'RECALL') return 'RECALL';
        if (normalized === 'APPLICATION' || normalized === 'APPLY') return 'APPLICATION';
        if (normalized === 'CLINICAL_REASONING' || normalized === 'REASONING') return 'CLINICAL_REASONING';
        if (normalized === 'ANALYSIS' || normalized === 'ANALYZE') return 'ANALYSIS';
        return null;
    }

    async findAll(params: {
        skip?: number;
        take?: number;
        topic?: string;
        difficulty?: string;
        source?: string;
        isPublished?: boolean;
    }): Promise<QuestionResponseDto[]> {



        const questions = await this.prisma.question.findMany({
            skip: params.skip,
            take: params.take,
            where: {
                topic: params.topic ? { name: params.topic } : undefined,
                difficulty: params.difficulty as any,
                source: params.source as any,
                isPublished: params.isPublished,
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
                topic: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return questions.map((q) => ({
            id: q.id,
            stem: q.stem,
            explanation: q.explanation,
            difficulty: q.difficulty,
            source: q.source,
            topicId: q.topicId,
            choices: q.choices.map((c) => ({
                id: c.id,
                text: c.text,
                isCorrect: c.isCorrect,
                order: c.order,
            })),
            tags: q.tags.map((qt) => qt.tag.name),
            isPublished: q.isPublished,
            createdAt: q.createdAt,
        }));
    }

    async findOneQuestion(id: string): Promise<QuestionResponseDto> {
        const question = await this.prisma.question.findUnique({
            where: { id },
            include: {
                choices: {
                    orderBy: { order: 'asc' },
                },
                tags: {
                    include: {
                        tag: true,
                    },
                },
                references: {
                    include: {
                        reference: true,
                    },
                },
                topic: true,
            },
        });

        if (!question) {
            throw new NotFoundException(`Question with ID "${id}" not found`);
        }

        return {
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
        };
    }

    async publishQuestion(id: string): Promise<QuestionResponseDto> {
        const question = await this.prisma.question.update({
            where: { id },
            data: { isPublished: true },
            include: {
                choices: {
                    orderBy: { order: 'asc' },
                },
                tags: {
                    include: {
                        tag: true,
                    },
                },
                topic: true,
            },
        });

        return {
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
        };
    }

    async deleteQuestion(id: string): Promise<void> {
        await this.prisma.question.delete({
            where: { id },
        });
    }

    // ============================================
    // Edit question and preserve an immutable pre-edit revision
    // ============================================
    async updateQuestion(id: string, dto: any, userId: string): Promise<QuestionDetailDto> {
        const existing = await this.prisma.question.findUnique({
            where: { id },
            include: {
                choices: { orderBy: { order: 'asc' } },
                wrongOptions: { orderBy: { order: 'asc' } },
                vitals: true,
                tags: { include: { tag: true } },
            },
        });

        if (!existing) throw new NotFoundException(`Question with ID "${id}" not found`);
        if (!dto.reason?.trim()) throw new Error('An edit reason is required');
        if (dto.choices && (dto.choices.length < 2 || dto.choices.filter((choice: any) => choice.isCorrect).length !== 1)) {
            throw new Error('A question must have at least two choices and exactly one correct choice');
        }

        const snapshot = this.buildQuestionSnapshot(existing);
        const revisionNumber = (await this.prisma.questionRevision.aggregate({
            where: { questionId: id }, _max: { revisionNumber: true },
        }))._max.revisionNumber ?? 0;

        const scalarFields = [
            'stem', 'leadInQuestion', 'explanation', 'topicId', 'difficulty', 'source',
            'sourceType',
            'system', 'discipline', 'patientProfile', 'chiefComplaint', 'keySymptoms',
            'physicalExam', 'mainClue', 'supportingClue', 'correctAnswerLetter',
            'correctAnswerText', 'stepByStepReasoning', 'educationalObjective', 'buzzwords',
            'buzzwordCombinationCorrect', 'relatedConcepts', 'suggestedImages',
        ];
        const questionData: Record<string, any> = {};
        for (const field of scalarFields) if (dto[field] !== undefined) questionData[field] = dto[field];

        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.questionRevision.create({
                data: {
                    questionId: id,
                    revisionNumber: revisionNumber + 1,
                    revisionType: 'HUMAN_EDIT',
                    snapshot: snapshot as any,
                    reason: dto.reason.trim(),
                    createdBy: userId,
                },
            });

            if (dto.choices) {
                await tx.choice.deleteMany({ where: { questionId: id } });
                questionData.choices = { create: dto.choices.map((choice: any, index: number) => ({
                    text: choice.text, isCorrect: choice.isCorrect, letter: String.fromCharCode(65 + index), order: index,
                })) };
            }
            if (dto.wrongOptions) {
                await tx.wrongOption.deleteMany({ where: { questionId: id } });
                questionData.wrongOptions = { create: dto.wrongOptions.map((option: any, index: number) => ({
                    letter: option.letter || String.fromCharCode(65 + index), text: option.text,
                    explanation: option.explanation ?? null, buzzwordCombo: option.buzzwordCombo ?? null, order: index,
                })) };
            }
            if (dto.vitals !== undefined) {
                if (dto.vitals === null) await tx.vitals.deleteMany({ where: { questionId: id } });
                else questionData.vitals = { upsert: { create: dto.vitals, update: dto.vitals } };
            }
            if (dto.tags) {
                await tx.questionTag.deleteMany({ where: { questionId: id } });
                const tagIds = await Promise.all(dto.tags.filter((tag: string) => tag.trim()).map((tag: string) =>
                    tx.tag.upsert({ where: { name: tag.trim() }, create: { name: tag.trim() }, update: {} }),
                ));
                questionData.tags = { create: tagIds.map((tag: any) => ({ tagId: tag.id })) };
            }

            // Any edit invalidates publication and prior human/AI approval.
            return tx.question.update({
                where: { id },
                data: { ...questionData, isPublished: false, reviewed: false, rejected: false, reviewedBy: null, reviewNotes: Prisma.JsonNull, qualityReview: { delete: {} } },
                include: { topic: { include: { subject: true } }, choices: { orderBy: { order: 'asc' } }, wrongOptions: { orderBy: { order: 'asc' } }, vitals: true, qualityReview: true, tags: { include: { tag: true } }, aiReviews: { orderBy: [{ attemptNumber: 'desc' }, { createdAt: 'desc' }] } },
            });
        });

        return this.mapToDetailDto(updated);
    }

    private buildQuestionSnapshot(question: any): Record<string, any> {
        const { choices, wrongOptions, vitals, tags, ...fields } = question;
        return {
            ...fields,
            choices: choices?.map((choice: any) => ({ text: choice.text, letter: choice.letter, isCorrect: choice.isCorrect, order: choice.order })),
            wrongOptions,
            vitals,
            tags: tags?.map((entry: any) => entry.tag.name),
        };
    }

    // ============================================
    // NEW: Review a question (approve, reject, or add notes)
    // Also tracks the question in the reviewer's reviewedQuestions list
    // ============================================
    async reviewQuestion(
        id: string,
        dto: {  rejected?: boolean; reviewedBy?: string; reviewNotes?: Record<string, any> },
    ): Promise<QuestionDetailDto> {
        const question = await this.prisma.question.findUnique({
            where: { id },
        });

        if (!question) {
            throw new NotFoundException(`Question with ID "${id}" not found`);
        }

        // Build update data
        const updateData: any = {
            reviewed: true,
        };

        // Handle rejected field
        if (dto.rejected !== undefined) {
            updateData.rejected = dto.rejected;
        }

        // If approved (reviewed=true, rejected=false), clear the rejected flag
        if (dto.rejected === false) {
            updateData.rejected = false;
        }

        if (dto.reviewNotes !== undefined) {
            updateData.reviewNotes = dto.reviewNotes;
        }

        if (dto.reviewedBy !== undefined) {
            updateData.reviewedBy = dto.reviewedBy;
        }

        // Does NOT publish the question yet - that happens after quality review
        const updatedQuestion = await this.prisma.question.update({
            where: { id },
            data: updateData,
            include: {
                topic: {
                    include: { subject: true },
                },
                choices: {
                    orderBy: { order: 'asc' },
                },
                wrongOptions: {
                    orderBy: { order: 'asc' },
                },
                vitals: true,
                qualityReview: true,
                tags: {
                    include: { tag: true },
                },
            },
        });

        // Track the question in the reviewer's reviewedQuestions list
        if (dto.reviewedBy) {
            const user = await this.prisma.user.findUnique({
                where: { id: dto.reviewedBy },
                select: { reviewedQuestions: true },
            });

            if (user && !user.reviewedQuestions.includes(id)) {
                await this.prisma.user.update({
                    where: { id: dto.reviewedBy },
                    data: {
                        reviewedQuestions: {
                            push: id,
                        },
                    },
                });
            }
        }

        return this.mapToDetailDto(updatedQuestion);
    }

    // ============================================
    // GET USER PREFERENCES: Get the user's preferred subjects for review assignment
    // ============================================
    async getUserPreferences(userId: string): Promise<{ preferredSubjects: string[] }> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { preferredSubjects: true },
        });

        if (!user) {
            throw new NotFoundException(`User with ID "${userId}" not found`);
        }

        return { preferredSubjects: user.preferredSubjects };
    }

    // ============================================
    // UPDATE USER PREFERENCES: Save the user's preferred subjects
    // ============================================
    async updateUserPreferences(userId: string, preferredSubjects: string[]): Promise<{ preferredSubjects: string[] }> {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: { preferredSubjects },
            select: { preferredSubjects: true },
        });

        return { preferredSubjects: user.preferredSubjects };
    }

    // ============================================
    // ASSIGN QUESTIONS TO USER: Lock 20 questions exclusively to this user
    // ============================================
    async assignQuestionsToUser(userId: string, subjects?: string[]): Promise<ReviewDashboardItemDto[]> {
        const ASSIGN_COUNT = 20;

        // 1. Get the user's preferred subjects (if not provided, use saved ones)
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { preferredSubjects: true, assignedQuestions: true, reviewedQuestions: true, skippedQuestions: true },
        });

        if (!user) {
            throw new NotFoundException(`User with ID "${userId}" not found`);
        }

        // If user already has assigned questions, check if there are still pending ones
        if (user.assignedQuestions.length > 0) {
            const pendingQuestions = await this.getQuestionsByIds(user.assignedQuestions, userId);
            if (pendingQuestions.length > 0) {
                // There are still pending questions - return them (user hasn't finished the bucket yet)
                return pendingQuestions;
            }
            // All assigned questions have been reviewed or skipped - clear them so we can assign a fresh bucket
            await this.prisma.user.update({
                where: { id: userId },
                data: { assignedQuestions: [] },
            });
            user.assignedQuestions = [];
        }

        const selectedSubjects = subjects || user.preferredSubjects;
        if (!selectedSubjects || selectedSubjects.length === 0) {
            throw new Error('Please select at least one subject to assign questions');
        }

        // 2. Collect all question IDs already assigned to ANY user (to avoid double-assignment)
        const allUsers = await this.prisma.user.findMany({
            select: { assignedQuestions: true },
        });
        const allAssignedIds = new Set<string>();
        allUsers.forEach((u) => {
            u.assignedQuestions.forEach((qId) => allAssignedIds.add(qId));
        });

        // 3. Also exclude user's own reviewed/skipped questions
        const userReviewedOrSkipped = new Set([
            ...user.reviewedQuestions,
            ...user.skippedQuestions,
        ]);

        // 4. Combine all exclude IDs
        const excludeIds = new Set([...allAssignedIds, ...userReviewedOrSkipped]);

        // 5. Find questions matching the subjects, not already assigned
        // Use raw query with subject filter and RANDOM() to pick 20
        let paramIndex = 1;
        const params: any[] = [];
        const conditions: string[] = [];

        // Subject filter
        const subjectConditions = selectedSubjects.map((s) => {
            const param = `$${paramIndex}`;
            paramIndex++;
            params.push(s);
            return `LOWER(s.name) = LOWER(${param})`;
        });
        conditions.push(`(${subjectConditions.join(' OR ')})`);

        // Exclude already assigned
        if (excludeIds.size > 0) {
            const excludeArray = Array.from(excludeIds);
            const placeholders = excludeArray.map((_, i) => `$${paramIndex + i}`);
            conditions.push(`q.id NOT IN (${placeholders.join(',')})`);
            params.push(...excludeArray);
            paramIndex += excludeArray.length;
        }

        const whereClause = 'WHERE ' + conditions.join(' AND ');

        const questions: any[] = await this.prisma.$queryRawUnsafe(`
            SELECT q.id, q.stem, q."sourceType", q.difficulty, q.reviewed, q.rejected, q."isPublished", q."createdAt",
                   t.id as topic_id, t.name as topic_name,
                   s.id as subject_id, s.name as subject_name
            FROM "Question" q
            JOIN "Topic" t ON t.id = q."topicId"
            JOIN "Subject" s ON s.id = t."subjectId"
            ${whereClause}
            ORDER BY RANDOM()
            LIMIT ${ASSIGN_COUNT}
        `, ...params);

        if (questions.length === 0) {
            throw new Error('No questions available for the selected subjects. All questions may already be assigned to other reviewers.');
        }

        // 6. Save the assigned question IDs to the user
        const assignedIds = questions.map((q: any) => q.id);
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                assignedQuestions: assignedIds,
                preferredSubjects: selectedSubjects,
            },
        });

        // 7. Return the questions
        return questions.map((q: any) => ({
            id: q.id,
            stem: q.stem,
            sourceType: q.sourceType,
            difficulty: q.difficulty,
            reviewed: q.reviewed,
            rejected: q.rejected,
            isPublished: q.isPublished,
            createdAt: q.createdAt,
            topic: {
                id: q.topic_id,
                name: q.topic_name,
                subject: {
                    id: q.subject_id,
                    name: q.subject_name,
                },
            },
        }));
    }

    // ============================================
    // HELPER: Get questions by IDs (for fetching assigned questions)
    // Excludes already reviewed or skipped questions
    // ============================================
    private async getQuestionsByIds(ids: string[], userId: string): Promise<ReviewDashboardItemDto[]> {
        if (ids.length === 0) return [];

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { reviewedQuestions: true, skippedQuestions: true },
        });

        const doneIds = new Set([
            ...(user?.reviewedQuestions || []),
            ...(user?.skippedQuestions || []),
        ]);

        // Filter out already reviewed/skipped questions
        const pendingIds = ids.filter((id) => !doneIds.has(id));

        if (pendingIds.length === 0) return [];

        const questions = await this.prisma.question.findMany({
            where: { id: { in: pendingIds } },
            include: {
                topic: {
                    include: { subject: true },
                },
            },
        });

        // Maintain the order from the user's assigned list
        const idOrder = new Map(pendingIds.map((id, index) => [id, index]));
        questions.sort((a, b) => (idOrder.get(a.id) || 0) - (idOrder.get(b.id) || 0));

        return questions.map((q) => ({
            id: q.id,
            stem: q.stem,
            sourceType: q.sourceType,
            difficulty: q.difficulty,
            reviewed: q.reviewed,
            rejected: q.rejected,
            isPublished: q.isPublished,
            createdAt: q.createdAt,
            topic: {
                id: q.topic.id,
                name: q.topic.name,
                subject: {
                    id: q.topic.subject.id,
                    name: q.topic.subject.name,
                },
            },
        }));
    }

    // ============================================
    // Get review dashboard: Returns user's assigned questions
    // ============================================
    async getReviewDashboardQuestions(filters: {
        userId?: string;
        subject?: string;
        topic?: string;
        limit?: number;
    }): Promise<ReviewDashboardItemDto[]> {
        const { userId } = filters;

        if (!userId) return [];

        // Get the user's assigned questions
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { assignedQuestions: true },
        });

        if (!user || user.assignedQuestions.length === 0) {
            return [];
        }

        return this.getQuestionsByIds(user.assignedQuestions, userId);
    }

    // ============================================
    // NEW: Get full question detail for review
    // ============================================
    async findFullDetail(id: string): Promise<QuestionDetailDto> {
        const question = await this.prisma.question.findUnique({
            where: { id },
            include: {
                topic: {
                    include: { subject: true },
                },
                choices: {
                    orderBy: { order: 'asc' },
                },
                wrongOptions: {
                    orderBy: { order: 'asc' },
                },
                vitals: true,
                qualityReview: true,
                tags: {
                    include: { tag: true },
                },
                aiReviews: {
                    orderBy: [{ attemptNumber: 'desc' }, { createdAt: 'desc' }],
                },
            },
        });

        if (!question) {
            throw new NotFoundException(`Question with ID "${id}" not found`);
        }

        return this.mapToDetailDto(question);
    }

    // ============================================
    // HELPER: Map question to full detail DTO
    // ============================================
    private mapToDetailDto(question: any): QuestionDetailDto {
        return {
            id: question.id,
            stem: question.stem,
            leadInQuestion: question.leadInQuestion,
            explanation: question.explanation,
            source: question.source,
            sourceType: question.sourceType,
            sourceRow: question.sourceRow,
            sourceFile: question.sourceFile,
            qid: question.qid,
            topicId: question.topicId,
            system: question.system,
            discipline: question.discipline,
            subsystem: question.subsystem,
            cognitiveLevel: question.cognitiveLevel,
            difficulty: question.difficulty,
            trapType: question.trapType,
            patientProfile: question.patientProfile,
            chiefComplaint: question.chiefComplaint,
            keySymptoms: question.keySymptoms,
            physicalExam: question.physicalExam,
            mainClue: question.mainClue,
            supportingClue: question.supportingClue,
            correctAnswerLetter: question.correctAnswerLetter,
            correctAnswerText: question.correctAnswerText,
            stepByStepReasoning: question.stepByStepReasoning,
            educationalObjective: question.educationalObjective,
            buzzwords: question.buzzwords,
            buzzwordCombinationCorrect: question.buzzwordCombinationCorrect,
            relatedConcepts: question.relatedConcepts,
            suggestedImages: question.suggestedImages,
            importedAt: question.importedAt,
            importedBy: question.importedBy,
            isPublished: question.isPublished,
            reviewed: question.reviewed,
            rejected: question.rejected,
            reviewedBy: question.reviewedBy,
            reviewNotes: question.reviewNotes,
            createdAt: question.createdAt,
            updatedAt: question.updatedAt,
            topic: {
                id: question.topic.id,
                name: question.topic.name,
                subject: {
                    id: question.topic.subject.id,
                    name: question.topic.subject.name,
                },
            },
            choices: question.choices.map((c: any) => ({
                id: c.id,
                text: c.text,
                isCorrect: c.isCorrect,
                order: c.order,
            })),
            wrongOptions: question.wrongOptions?.map((wo: any) => ({
                id: wo.id,
                letter: wo.letter,
                text: wo.text,
                explanation: wo.explanation,
                buzzwordCombo: wo.buzzwordCombo,
                order: wo.order,
            })) || [],
            vitals: question.vitals
                ? {
                    bloodPressure: question.vitals.bloodPressure,
                    heartRate: question.vitals.heartRate,
                    pulseOximetry: question.vitals.pulseOximetry,
                    temperature: question.vitals.temperature,
                    respiratoryRate: question.vitals.respiratoryRate,
                }
                : null,
            qualityReview: question.qualityReview
                ? {
                    id: question.qualityReview.id,
                    medicalAccuracy: question.qualityReview.medicalAccuracy,
                    usmleStyle: question.qualityReview.usmleStyle,
                    explanationQuality: question.qualityReview.explanationQuality,
                    originality: question.qualityReview.originality,
                    grammar: question.qualityReview.grammar,
                    vignetteReview: question.qualityReview.vignetteReview,
                    buzzwordReview: question.qualityReview.buzzwordReview,
                    reviewedBy: question.qualityReview.reviewedBy,
                    reviewedAt: question.qualityReview.reviewedAt,
                }
                : null,
            tags: question.tags.map((qt: any) => qt.tag.name),
            aiReviews: question.aiReviews?.map((ar: any) => ({
                id: ar.id,
                attemptNumber: ar.attemptNumber,
                verdict: ar.verdict,
                usmleStyleScore: ar.usmleStyleScore,
                medicalAccuracyScore: ar.medicalAccuracyScore,
                hallucinationRiskScore: ar.hallucinationRiskScore,
                explanationQualityScore: ar.explanationQualityScore,
                clinicalRelevanceScore: ar.clinicalRelevanceScore,
                grammaticalQualityScore: ar.grammaticalQualityScore,
                usmleStyleFeedback: ar.usmleStyleFeedback,
                medicalAccuracyFeedback: ar.medicalAccuracyFeedback,
                hallucinationDetails: ar.hallucinationDetails,
                explanationQualityFeedback: ar.explanationQualityFeedback,
                clinicalRelevanceFeedback: ar.clinicalRelevanceFeedback,
                grammaticalFeedback: ar.grammaticalFeedback,
                generalFeedback: ar.generalFeedback,
                reviewedByAi: ar.reviewedByAi,
                criticalIssues: ar.criticalIssues,
                humanRejectionContext: ar.humanRejectionContext,
                humanAiAgreement: ar.humanAiAgreement,
                createdAt: ar.createdAt,
            })) || [],
        };
    }

    // ============================================
    // NEW: Get questions reviewed by a user
    // ============================================
    async getReviewedQuestionsByUser(userId: string, filters?: {
        skip?: number;
        take?: number;
    }): Promise<{ data: ReviewDashboardItemDto[]; total: number; page: number; limit: number }> {
        const { skip = 0, take = 50 } = filters || {};

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { reviewedQuestions: true },
        });

        if (!user || user.reviewedQuestions.length === 0) {
            return { data: [], total: 0, page: 1, limit: take };
        }

        const questionIds = user.reviewedQuestions;
        const total = questionIds.length;

        // Paginate the IDs array
        const paginatedIds = questionIds.slice(skip, skip + take);

        const questions = await this.prisma.question.findMany({
            where: { id: { in: paginatedIds } },
            include: {
                topic: {
                    include: { subject: true },
                },
            },
        });

        // Maintain the order from the user's list (most recently reviewed first)
        const idOrder = new Map(paginatedIds.reverse().map((id, index) => [id, index]));
        questions.sort((a, b) => (idOrder.get(a.id) || 0) - (idOrder.get(b.id) || 0));

        const page = Math.floor(skip / take) + 1;

        return {
            data: questions.map((q) => ({
                id: q.id,
                stem: q.stem,
                sourceType: q.sourceType,
                difficulty: q.difficulty,
                reviewed: q.reviewed,
                rejected: q.rejected,
                isPublished: q.isPublished,
                createdAt: q.createdAt,
                topic: {
                    id: q.topic.id,
                    name: q.topic.name,
                    subject: {
                        id: q.topic.subject.id,
                        name: q.topic.subject.name,
                    },
                },
            })),
            total,
            page,
            limit: take,
        };
    }

    // ============================================
    // NEW: Get questions skipped by a user
    // ============================================
    async getSkippedQuestionsByUser(userId: string, filters?: {
        skip?: number;
        take?: number;
    }): Promise<{ data: ReviewDashboardItemDto[]; total: number; page: number; limit: number }> {
        const { skip = 0, take = 50 } = filters || {};

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { skippedQuestions: true },
        });

        if (!user || user.skippedQuestions.length === 0) {
            return { data: [], total: 0, page: 1, limit: take };
        }

        const questionIds = user.skippedQuestions;
        const total = questionIds.length;

        // Paginate the IDs array
        const paginatedIds = questionIds.slice(skip, skip + take);

        const questions = await this.prisma.question.findMany({
            where: { id: { in: paginatedIds } },
            include: {
                topic: {
                    include: { subject: true },
                },
            },
        });

        // Maintain the order from the user's list (most recently skipped first)
        const idOrder = new Map(paginatedIds.reverse().map((id, index) => [id, index]));
        questions.sort((a, b) => (idOrder.get(a.id) || 0) - (idOrder.get(b.id) || 0));

        const page = Math.floor(skip / take) + 1;

        return {
            data: questions.map((q) => ({
                id: q.id,
                stem: q.stem,
                sourceType: q.sourceType,
                difficulty: q.difficulty,
                reviewed: q.reviewed,
                rejected: q.rejected,
                isPublished: q.isPublished,
                createdAt: q.createdAt,
                topic: {
                    id: q.topic.id,
                    name: q.topic.name,
                    subject: {
                        id: q.topic.subject.id,
                        name: q.topic.subject.name,
                    },
                },
            })),
            total,
            page,
            limit: take,
        };
    }

    // ============================================
    // NEW: Mark a question as skipped by a user
    // ============================================
    async markQuestionAsSkipped(userId: string, questionId: string): Promise<void> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { skippedQuestions: true },
        });

        if (!user) {
            throw new NotFoundException(`User with ID "${userId}" not found`);
        }

        // Only add if not already in the list
        if (!user.skippedQuestions.includes(questionId)) {
            await this.prisma.user.update({
                where: { id: userId },
                data: {
                    skippedQuestions: {
                        push: questionId,
                    },
                },
            });
        }
    }

    // ============================================
    // NEW: Save / update quality review for a question
    // ============================================
    async saveQualityReview(
        questionId: string,
        dto: {
            medicalAccuracy?: string;
            usmleStyle?: string;
            explanationQuality?: string;
            originality?: string;
            grammar?: string;
            vignetteReview?: string;
            buzzwordReview?: string;
            reviewedBy?: string;
        },
    ) {
        const question = await this.prisma.question.findUnique({
            where: { id: questionId },
        });

        if (!question) {
            throw new NotFoundException(`Question with ID "${questionId}" not found`);
        }
        if (!question.reviewed || question.rejected) {
            throw new BadRequestException('The question must be approved by a human reviewer before publication review.');
        }

        const qualityReview = await this.prisma.qualityReview.upsert({
            where: { questionId },
            create: {
                questionId,
                ...dto,
            },
            update: {
                ...dto,
                reviewedAt: new Date(),
            },
        });

        // After quality review is complete, publish the question
        await this.prisma.question.update({
            where: { id: questionId },
            data: {
                isPublished: true,
                reviewed: true,
            },
        });

        // Track the question in the reviewer's reviewedQuestions list
        if (dto.reviewedBy) {
            const user = await this.prisma.user.findUnique({
                where: { id: dto.reviewedBy },
                select: { reviewedQuestions: true },
            });

            if (user && !user.reviewedQuestions.includes(questionId)) {
                await this.prisma.user.update({
                    where: { id: dto.reviewedBy },
                    data: {
                        reviewedQuestions: {
                            push: questionId,
                        },
                    },
                });
            }
        }

        return qualityReview;
    }

    // ============================================
    // NEW: Unpublish all questions by discipline
    // ============================================
    async unpublishByDiscipline(discipline: string): Promise<{ count: number }> {
        const result = await this.prisma.question.updateMany({
            where: {
                discipline: {
                    equals: discipline,
                    mode: 'insensitive',
                },
                isPublished: true,
            },
            data: {
                isPublished: false,
                reviewed: false,
            },
        });

        this.logger.log(`Unpublished ${result.count} questions for discipline: ${discipline}`);
        return { count: result.count };
    }
}