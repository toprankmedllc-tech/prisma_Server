import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateQuestionsDto } from '../questions/dto/request.dto';

// ============================================
// QUEUE SERVICE: Manages question generation jobs in PostgreSQL
// ============================================
// This service uses PostgreSQL SKIP LOCKED for job queuing instead of Redis/BullMQ.
// Jobs are stored in the GenerationJob table and processed by a background worker
// that polls for queued jobs using SKIP LOCKED to claim them atomically.
// ============================================

@Injectable()
export class QuestionQueueService {
    private readonly logger = new Logger(QuestionQueueService.name);

    constructor(
        private readonly prisma: PrismaService,
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
        // Create a GenerationJob record in PostgreSQL with status "queued"
        const generationJob = await this.prisma.generationJob.create({
            data: {
                userId: userId || null,
                params: dto as any, // Store the DTO as JSON
                status: 'queued',
                questionCount: dto.count,
            },
        });

        const jobId = generationJob.id;

        this.logger.log(
            `Queued generation job ${jobId}: ${dto.count} ${dto.sourceType} question(s) on "${dto.topic}" (user: ${userId || 'anonymous'})`,
        );

        return {
            jobId,
            status: 'queued',
            message: `Question generation queued. You can check status at GET /admin/queue/jobs/${jobId}.`,
        };
    }

    // ============================================
    // CLAIM NEXT QUEUED JOB (for background worker)
    // ============================================
    async claimNextJob(workerId: string): Promise<{
        id: string;
        params: any;
        userId: string | null;
    } | null> {
        // Use SKIP LOCKED to atomically claim the next queued job
        // This is the PostgreSQL-native way to do job queuing without Redis
        const job = await this.prisma.$queryRaw<
            Array<{
                id: string;
                params: any;
                userId: string | null;
            }>
        >`
            UPDATE "GenerationJob"
            SET status = 'processing',
                "updatedAt" = NOW()
            WHERE id = (
                SELECT id FROM "GenerationJob"
                WHERE status = 'queued'
                ORDER BY "createdAt" ASC
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            RETURNING id, params, "userId"
        `;

        if (job.length === 0) {
            return null;
        }

        return job[0];
    }

    // ============================================
    // UPDATE JOB STATUS
    // ============================================
    async updateJobStatus(
        jobId: string,
        status: 'queued' | 'processing' | 'completed' | 'failed',
        updates?: {
            questionIds?: string[];
            questionCount?: number;
            errorMessage?: string;
        },
    ): Promise<void> {
        await this.prisma.generationJob.update({
            where: { id: jobId },
            data: {
                status,
                ...(updates?.questionIds && { questionIds: updates.questionIds }),
                ...(updates?.questionCount !== undefined && { questionCount: updates.questionCount }),
                ...(updates?.errorMessage && { errorMessage: updates.errorMessage }),
            },
        });
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
    // GET QUEUE METRICS (PostgreSQL-based)
    // ============================================
    async getQueueMetrics(): Promise<{
        queueMetrics: {
            queued: number;
            processing: number;
            completed: number;
            failed: number;
        };
    }> {
        const [queued, processing, completed, failed] = await Promise.all([
            this.prisma.generationJob.count({ where: { status: 'queued' } }),
            this.prisma.generationJob.count({ where: { status: 'processing' } }),
            this.prisma.generationJob.count({ where: { status: 'completed' } }),
            this.prisma.generationJob.count({ where: { status: 'failed' } }),
        ]);

        return {
            queueMetrics: {
                queued,
                processing,
                completed,
                failed,
            },
        };
    }

    // ============================================
    // GET USER'S GENERATION JOBS
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
