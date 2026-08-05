import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QuestionGenerationService } from '../questions/question-generation.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionGenerationGateway } from './question-generation.gateway';
import { GenerateQuestionsDto } from '../questions/dto/request.dto';

// ============================================
// BULLMQ WORKER: Processes question generation jobs in the background
// ============================================
// This worker picks up jobs from the "question-generation" queue and runs
// the LLM-based question generation. On completion, it updates the
// GenerationJob record in the database and emits a Socket.IO event.
// ============================================

@Processor('question-generation', {
    concurrency: 2, // Process up to 2 jobs simultaneously
})
export class QuestionQueueProcessor extends WorkerHost {
    private readonly logger = new Logger(QuestionQueueProcessor.name);

    constructor(
        private readonly questionGenerationService: QuestionGenerationService,
        private readonly prisma: PrismaService,
        private readonly gateway: QuestionGenerationGateway,
    ) {
        super();
    }

    async process(job: Job<{
        generationJobId: string;
        userId: string;
        dto: GenerateQuestionsDto;
    }>, token?: string): Promise<any> {
        const { generationJobId, userId, dto } = job.data;

        this.logger.log(
            `Processing job ${job.id} (generationJobId: ${generationJobId}): ${dto.count} ${dto.sourceType} question(s) on "${dto.topic}"`,
        );

        try {
            // Update job status to "processing"
            await this.prisma.generationJob.update({
                where: { id: generationJobId },
                data: { status: 'processing' },
            });

            // Notify the user that generation is in progress
            this.gateway.emitJobProcessing(userId, {
                jobId: generationJobId,
                status: 'processing',
                message: `Generating ${dto.count} ${dto.sourceType} question(s) on "${dto.topic}"...`,
            });

            // ============================================
            // RUN THE ACTUAL LLM-BASED QUESTION GENERATION
            // ============================================
            const result = await this.questionGenerationService.generateQuestions(dto);

            const questionIds = result.questions.map((q) => q.id);

            // Update job record to "completed"
            await this.prisma.generationJob.update({
                where: { id: generationJobId },
                data: {
                    status: 'completed',
                    questionIds,
                    questionCount: result.questions.length,
                },
            });

            // ============================================
            // EMIT COMPLETION EVENT VIA SOCKET.IO
            // ============================================
            this.gateway.emitJobCompleted(userId, {
                jobId: generationJobId,
                status: 'completed',
                message: `Successfully generated ${result.questions.length} ${dto.sourceType} question(s) on "${dto.topic}"`,
                questionIds,
                questionCount: result.questions.length,
                sourceType: dto.sourceType,
            });

            this.logger.log(
                `Job ${job.id} completed: ${result.questions.length} questions generated`,
            );

            return result;
        } catch (error: any) {
            this.logger.error(
                `Job ${job.id} failed: ${error.message}`,
                error.stack,
            );

            // Update job record to "failed"
            await this.prisma.generationJob.update({
                where: { id: generationJobId },
                data: {
                    status: 'failed',
                    errorMessage: error.message,
                },
            });

            // Emit failure event
            this.gateway.emitJobFailed(userId, {
                jobId: generationJobId,
                status: 'failed',
                message: `Question generation failed: ${error.message}`,
                error: error.message,
            });

            // Re-throw so BullMQ marks the job as failed
            throw error;
        }
    }
}