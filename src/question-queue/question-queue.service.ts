import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionGenerationGateway } from './question-generation.gateway';
import { GenerateQuestionsDto } from '../questions/dto/request.dto';

// ============================================
// QUEUE SERVICE: Adds question generation jobs to the BullMQ queue
// ============================================
// This service:
// 1. Creates a GenerationJob record in PostgreSQL for persistence
// 2. Adds the job to the BullMQ queue for background processing
// 3. Returns the job ID to the frontend so it can track progress
// ============================================

@Injectable()
export class QuestionQueueService {
    private readonly logger = new Logger(QuestionQueueService.name);

    constructor(
        @InjectQueue('question-generation')
        private readonly questionGenerationQueue: Queue,
        private readonly prisma: PrismaService,
        private readonly gateway: QuestionGenerationGateway,
    ) { }

    // ============================================
    // QUEUE A QUESTION GENERATION JOB
    // ============================================
    async queueGeneration(
        dto: GenerateQuestionsDto,
        userId?: string,
    ): Promise<{
        jobId: string;
        status: string;
        message: string;
    }> {
        // 1. Create a GenerationJob record in PostgreSQL
        const generationJob = await this.prisma.generationJob.create({
            data: {
                userId: userId || null,
                params: dto as any, // Store the DTO as JSON
                status: 'queued',
                questionCount: dto.count,
            },
        });

        const jobId = generationJob.id;

        // 2. Add the job to BullMQ queue
        // The job name matches the processor's consumer name
        await this.questionGenerationQueue.add(
            'generate-questions',
            {
                generationJobId: jobId,
                userId: userId || 'anonymous',
                dto,
            },
            {
                // Remove job from queue after 24 hours
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 86400 },
                // Retry up to 2 times on failure
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000, // Start with 5s delay, then exponential
                },
            },
        );

        // 3. Emit a notification that the job has been queued
        if (userId) {
            this.gateway.emitJobQueued(userId, {
                jobId,
                status: 'queued',
                message: `Queued generation of ${dto.count} ${dto.sourceType} question(s) on "${dto.topic}"`,
            });
        }

        this.logger.log(
            `Queued generation job ${jobId}: ${dto.count} ${dto.sourceType} question(s) on "${dto.topic}" (user: ${userId || 'anonymous'})`,
        );

        return {
            jobId,
            status: 'queued',
            message: `Question generation queued. You'll be notified when it's complete.`,
        };
    }

    // ============================================
    // GET JOB STATUS
    // ============================================
    async getJobStatus(jobId: string): Promise<{
        id: string;
        status: string;
        params: any;
        questionIds: string[];
        questionCount: number;
        errorMessage: string | null;
        createdAt: Date;
        updatedAt: Date;
    } | null> {
        const job = await this.prisma.generationJob.findUnique({
            where: { id: jobId },
        });

        if (!job) return null;

        return {
            id: job.id,
            status: job.status,
            params: job.params,
            questionIds: job.questionIds,
            questionCount: job.questionCount,
            errorMessage: job.errorMessage,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
        };
    }

    // ============================================
    // GET ALL JOBS (admin view)
    // ============================================
    async getAllJobs(
        limit = 50,
        offset = 0,
        status?: string,
    ): Promise<{
        jobs: Array<{
            id: string;
            userId: string | null;
            status: string;
            params: any;
            questionIds: string[];
            questionCount: number;
            errorMessage: string | null;
            createdAt: Date;
            updatedAt: Date;
        }>;
        total: number;
    }> {
        const where: any = {};
        if (status) {
            where.status = status;
        }

        const [jobs, total] = await Promise.all([
            this.prisma.generationJob.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.generationJob.count({ where }),
        ]);

        return {
            jobs: jobs.map((job) => ({
                id: job.id,
                userId: job.userId,
                status: job.status,
                params: job.params,
                questionIds: job.questionIds,
                questionCount: job.questionCount,
                errorMessage: job.errorMessage,
                createdAt: job.createdAt,
                updatedAt: job.updatedAt,
            })),
            total,
        };
    }

    // ============================================
    // GET QUEUE METRICS & REDIS STATUS
    // ============================================
    async getQueueMetrics(): Promise<{
        redisConnected: boolean;
        queueMetrics: {
            waiting: number;
            active: number;
            completed: number;
            failed: number;
            delayed: number;
        };
    }> {
        let redisConnected = false;
        const counts = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };

        try {
            // Check if Redis is reachable by getting queue job counts
            const jobCounts = await this.questionGenerationQueue.getJobCounts();
            counts.waiting = jobCounts.waiting || 0;
            counts.active = jobCounts.active || 0;
            counts.completed = jobCounts.completed || 0;
            counts.failed = jobCounts.failed || 0;
            counts.delayed = jobCounts.delayed || 0;
            redisConnected = true;
        } catch (error: any) {
            this.logger.error(`Failed to get queue metrics from Redis: ${error.message}`);
            redisConnected = false;
        }

        return {
            redisConnected,
            queueMetrics: counts,
        };
    }

    // ============================================
    // GET BULLMQ JOBS BY STATUS
    // ============================================
    async getBullJobsByStatus(
        status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
        limit = 20,
    ): Promise<Array<{
        bullJobId: string | number | undefined;
        generationJobId: string;
        status: string;
        data: any;
        failedReason?: string;
        stacktrace?: string[];
        processedOn?: string;
        finishedOn?: string;
        createdAt?: string;
        attemptsMade: number;
    }>> {
        try {
            let bullJobs;
            switch (status) {
                case 'waiting':
                    bullJobs = await this.questionGenerationQueue.getWaiting(0, limit);
                    break;
                case 'active':
                    bullJobs = await this.questionGenerationQueue.getActive(0, limit);
                    break;
                case 'completed':
                    bullJobs = await this.questionGenerationQueue.getCompleted(0, limit);
                    break;
                case 'failed':
                    bullJobs = await this.questionGenerationQueue.getFailed(0, limit);
                    break;
                case 'delayed':
                    bullJobs = await this.questionGenerationQueue.getDelayed(0, limit);
                    break;
                default:
                    bullJobs = [];
            }

            return bullJobs.map((job) => ({
                bullJobId: job.id,
                generationJobId: job.data?.generationJobId || 'unknown',
                status: status,
                data: job.data,
                failedReason: job.failedReason,
                stacktrace: job.stacktrace,
                processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : undefined,
                finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
                createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : undefined,
                attemptsMade: job.attemptsMade,
            }));
        } catch (error: any) {
            this.logger.error(`Failed to get BullMQ jobs for status ${status}: ${error.message}`);
            return [];
        }
    }

    // ============================================
    // GET ALL JOBS FOR A USER
    // ============================================
    async getUserJobs(
        userId: string,
        limit = 20,
    ): Promise<Array<{
        id: string;
        status: string;
        questionCount: number;
        questionIds: string[];
        errorMessage: string | null;
        createdAt: Date;
    }>> {
        const jobs = await this.prisma.generationJob.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true,
                status: true,
                questionCount: true,
                questionIds: true,
                errorMessage: true,
                createdAt: true,
            },
        });

        return jobs;
    }
}