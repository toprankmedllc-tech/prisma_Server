import { Module, forwardRef } from '@nestjs/common';

import { AiReviewController } from './ai-review.controller';
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
// - Manual review via API endpoints only
// - No automatic background processing
// - Admin endpoints for batch and single review
// ============================================

@Module({
  imports: [
    PrismaModule,
    LLMModule,
    ChromaModule,
    forwardRef(() => QuestionsModule), // To get QuestionGenerationService
  ],
  controllers: [AiReviewController],
  providers: [AiReviewService],
  exports: [AiReviewService],
})
export class AiReviewModule {}