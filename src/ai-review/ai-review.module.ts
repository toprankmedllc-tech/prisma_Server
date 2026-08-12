import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { AiReviewController } from './ai-review.controller';
import { AiReviewProcessor } from './ai-review.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { LLMModule } from '../llm/llm.module';
import { ChromaModule } from '../chroma/chroma.module';
import { QuestionsModule } from '../questions/questions.module';
import { AiReviewService } from './ai-review.service';

// ============================================
// AI REVIEW MODULE
// ============================================
// Provides:
// - AI-powered quality review of USMLE questions
// - BullMQ queue for background AI review processing
// - Auto-approve PASS questions / auto-regenerate FAIL questions
// - Admin endpoints for batch and single review
// ============================================

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'ai-review',
    }),
    PrismaModule,
    LLMModule,
    ChromaModule,
    forwardRef(() => QuestionsModule), // To get QuestionGenerationService
  ],
  controllers: [AiReviewController],
  providers: [AiReviewService, AiReviewProcessor],
  exports: [AiReviewService, AiReviewProcessor],
})
export class AiReviewModule {}