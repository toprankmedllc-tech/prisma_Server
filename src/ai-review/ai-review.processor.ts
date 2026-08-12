import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AiReviewService } from './ai-review.service';


// ============================================
// BULLMQ WORKER: Processes AI review jobs in the background
// ============================================
// This worker picks up jobs from the "ai-review" queue and runs
// the AI-based quality review on questions. Supports both single
// question reviews and batch reviews.
// ============================================

@Processor('ai-review', {
  concurrency: 2, // Process up to 2 jobs simultaneously
})
export class AiReviewProcessor extends WorkerHost {
  private readonly logger = new Logger(AiReviewProcessor.name);

  constructor(private readonly aiReviewService: AiReviewService) {
    super();
  }

  async process(job: Job<{
    type: 'single' | 'batch';
    questionId?: string;
    questionIds?: string[];
    options?: {
      autoPublish?: boolean;
      autoRegenerate?: boolean;
    };
  }>): Promise<any> {
    this.logger.log(`Processing AI review job ${job.id} (type: ${job.data.type})`);

    try {
      if (job.data.type === 'single' && job.data.questionId) {
        // Single question review
        const result = await this.aiReviewService.reviewQuestion(
          job.data.questionId,
          job.data.options,
        );
        this.logger.log(
          `AI review job ${job.id} completed: question ${result.questionId} -> ${result.verdict}`,
        );
        return result;
      } else if (job.data.type === 'batch' && job.data.questionIds) {
        // Batch review
        const result = await this.aiReviewService.batchReview(
          job.data.questionIds,
          job.data.options,
        );
        this.logger.log(
          `AI review batch job ${job.id} completed: ${result.passed} passed, ${result.failed} failed`,
        );
        return result;
      } else {
        throw new Error('Invalid job data: must specify type and questionId/questionIds');
      }
    } catch (error: any) {
      this.logger.error(`AI review job ${job.id} failed: ${error.message}`);
      throw error;
    }
  }
}