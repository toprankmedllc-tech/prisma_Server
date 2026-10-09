import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QuestionQueueService } from './question-queue.service';
import { QuestionGenerationService } from '../questions/question-generation.service';
import { PrismaService } from '../prisma/prisma.service';

// ============================================
// BACKGROUND WORKER: Processes question generation jobs from PostgreSQL
// ============================================
// This worker polls the GenerationJob table for "queued" jobs using
// PostgreSQL's SKIP LOCKED feature to atomically claim jobs.
// No Redis or BullMQ required.
// ============================================

@Injectable()
export class QuestionQueueProcessor implements OnModuleInit {
    private readonly logger = new Logger(QuestionQueueProcessor.name);
    private readonly workerId = `worker-${Date.now()}`;
    private isRunning = false;
    private pollInterval: NodeJS.Timeout | null = null;

    constructor(
        private readonly questionQueueService: QuestionQueueService,
        private readonly questionGenerationService: QuestionGenerationService,
        private readonly prisma: PrismaService,
    ) { }

    async onModuleInit() {
        this.logger.log(`QuestionQueueProcessor initialized (workerId: ${this.workerId})`);
        this.startWorker();
    }

    private startWorker() {
        this.isRunning = true;
        this.logger.log('Starting PostgreSQL-based question generation worker...');

        // Poll for new jobs every 5 seconds
        this.pollInterval = setInterval(() => {
            this.processNextJob().catch((error) => {
                this.logger.error(`Worker error: ${error.message}`, error.stack);
            });
        }, 5000);
    }

    private async processNextJob(): Promise<void> {
        if (!this.isRunning) return;

        try {
            // Atomically claim the next queued job using SKIP LOCKED
            const job = await this.questionQueueService.claimNextJob(this.workerId);

            if (!job) {
                // No jobs to process
                return;
            }

            this.logger.log(
                `Processing job ${job.id} (user: ${job.userId || 'anonymous'})`,
            );

            try {
                // Run the actual LLM-based question generation
                const result = await this.questionGenerationService.generateQuestions(job.params);

                const questionIds = result.questions.map((q) => q.id);

                // Update job record to "completed"
                await this.questionQueueService.updateJobStatus(job.id, 'completed', {
                    questionIds,
                    questionCount: result.questions.length,
                });

                this.logger.log(
                    `Job ${job.id} completed: ${result.questions.length} questions generated`,
                );
            } catch (error: any) {
                this.logger.error(
                    `Job ${job.id} failed: ${error.message}`,
                    error.stack,
                );

                // Update job record to "failed"
                await this.questionQueueService.updateJobStatus(job.id, 'failed', {
                    errorMessage: error.message,
                });
            }
        } catch (error: any) {
            this.logger.error(`Failed to claim/process job: ${error.message}`);
        }
    }

    async stopWorker() {
        this.isRunning = false;
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.logger.log('Question generation worker stopped');
    }
}
