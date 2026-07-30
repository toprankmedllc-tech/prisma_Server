import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionResponseDto, ReviewDashboardItemDto, QuestionDetailDto } from './dto/response.dto';
import { CognitiveLevel, Difficulty, QuestionSource, QuestionSourceType, Tag, Topic } from '@prisma/client';

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

        // Get disciplines with counts
        const disciplineGroups = await this.prisma.question.groupBy({
            by: ['discipline'],
            where: { discipline: { not: null } },
            _count: true,
        });

        const byDiscipline: Record<string, number> = {};
        disciplineGroups.forEach(group => {
            if (group.discipline) {
                byDiscipline[group.discipline] = group._count;
            }
        });

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
            byDiscipline,
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

    async findOne(id: string): Promise<QuestionResponseDto> {
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
    // NEW: Get review dashboard questions (random, up to 20, by subject/topic)
    // Excludes questions the user has already reviewed or skipped
    // ============================================
    async getReviewDashboardQuestions(filters: {
        userId?: string;
        subject?: string;
        topic?: string;
        limit?: number;
    }): Promise<ReviewDashboardItemDto[]> {
        const { userId, subject, topic, limit = 20 } = filters;

        // Get the user's already-processed question IDs
        let reviewedQuestionIds: string[] = [];
        let skippedQuestionIds: string[] = [];

        if (userId) {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { reviewedQuestions: true, skippedQuestions: true },
            });
            if (user) {
                reviewedQuestionIds = user.reviewedQuestions;
                skippedQuestionIds = user.skippedQuestions;
            }
        }

        const excludeIds = [...new Set([...reviewedQuestionIds, ...skippedQuestionIds])];

        const where: any = {};
        const topicWhere: any = {};

        if (subject) {
            topicWhere.subject = {
                name: { equals: subject, mode: 'insensitive' },
            };
        }

        if (topic) {
            topicWhere.name = { equals: topic, mode: 'insensitive' };
        }

        if (Object.keys(topicWhere).length > 0) {
            where.topic = topicWhere;
        }

        // Exclude already-processed questions
        if (excludeIds.length > 0) {
            where.id = { notIn: excludeIds };
        }

        // Get total count first
        const totalCount = await this.prisma.question.count({ where });

        if (totalCount === 0) {
            return [];
        }

        // Use raw query to get random questions efficiently
        const take = Math.min(limit, totalCount);

        // Build parameterized query with exclude list
        let paramIndex = 1;
        const params: any[] = [];
        const conditions: string[] = [];

        if (subject) {
            conditions.push(`LOWER(s.name) = LOWER($${paramIndex})`);
            params.push(subject);
            paramIndex++;
        }

        if (topic) {
            conditions.push(`LOWER(t.name) = LOWER($${paramIndex})`);
            params.push(topic);
            paramIndex++;
        }

        if (excludeIds.length > 0) {
            // Build a parameterized NOT IN clause
            const placeholders = excludeIds.map((_, i) => `$${paramIndex + i}`);
            conditions.push(`q.id NOT IN (${placeholders.join(',')})`);
            params.push(...excludeIds);
            paramIndex += excludeIds.length;
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        const questions: any[] = await this.prisma.$queryRawUnsafe(`
            SELECT q.id, q.stem, q."sourceType", q.difficulty, q.reviewed, q.rejected, q."isPublished", q."createdAt",
                   t.id as topic_id, t.name as topic_name,
                   s.id as subject_id, s.name as subject_name
            FROM "Question" q
            JOIN "Topic" t ON t.id = q."topicId"
            JOIN "Subject" s ON s.id = t."subjectId"
            ${whereClause}
            ORDER BY RANDOM()
            LIMIT ${take}
        `, ...params);

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